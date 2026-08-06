"""
kolafi-worker coordinator：把六種任務類型的背景迴圈合併到同一個 process、同一個
Flask app 裡跑，取代原本各自獨立 port 的作法。

崩潰策略：任一背景 thread 跳出未接住的例外就讓整個 process 直接死掉，交給
docker-compose 重啟；六種任務類型沒有各自獨立重啟，換取邏輯單純。
"""
import os
import sys
import threading

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 讓子資料夾維持原本的直接 import 寫法（如 `import s3_client`），不必改成套件相對匯入
for _sub in ('shared', 'thumbnail', 'cleanup', 'caption', 'export', 'tag', 'download'):
    sys.path.insert(0, os.path.join(BASE_DIR, _sub))

from flask import Flask, jsonify  # noqa: E402

from logger import get_logger  # noqa: E402
from worker_framework import WorkerFramework  # noqa: E402

import thumbnail_worker  # noqa: E402
import cleanup_worker  # noqa: E402
import caption_worker  # noqa: E402
import export_worker  # noqa: E402
import tag_worker  # noqa: E402
import download_worker  # noqa: E402

logger = get_logger('kolafi-worker')

# 各模組維持原本的 TASK_TYPE / process_task，不呼叫各自的 main()，改由 coordinator 統一管理 thread
TASK_MODULES = [
    thumbnail_worker,
    cleanup_worker,
    caption_worker,
    export_worker,
    tag_worker,
    download_worker,
]

PORT = int(os.environ.get('PORT', '8080'))

_frameworks: dict[str, WorkerFramework] = {}
_threads: dict[str, threading.Thread] = {}


def _run_with_crash_policy(task_type: str, framework: WorkerFramework) -> None:
    try:
        framework.run_loop()
    except Exception:
        logger.exception(
            "[%s] 背景 thread 發生未被業務邏輯接住的例外，process 即將整個結束（交給 restart 全部重開）",
            task_type,
        )
        os._exit(1)


def _start_all() -> None:
    for module in TASK_MODULES:
        task_type = module.TASK_TYPE
        framework = WorkerFramework(task_type, module.process_task)
        thread = threading.Thread(
            target=_run_with_crash_policy,
            args=(task_type, framework),
            daemon=True,
            name=f'{task_type}-worker-loop',
        )
        _frameworks[task_type] = framework
        _threads[task_type] = thread
        thread.start()
        logger.info("[%s] 背景 thread 已啟動", task_type)


app = Flask('kolafi-worker')


@app.route('/notify/<task_type>', methods=['POST'])
def notify(task_type):
    framework = _frameworks.get(task_type)
    if framework is None:
        return jsonify({'status': 'error', 'message': f'unknown task type: {task_type}'}), 404
    framework.notify()
    return jsonify({'status': 'ok'}), 200


@app.route('/healthz', methods=['GET'])
def healthz():
    """只反映六條背景 thread 是否存活，不含逐任務類型的活動時間監控。"""
    threads_alive = {task_type: thread.is_alive() for task_type, thread in _threads.items()}
    all_alive = all(threads_alive.values())
    status_code = 200 if all_alive else 503
    return jsonify({'status': 'ok' if all_alive else 'degraded', 'threads': threads_alive}), status_code


def main():
    _start_all()
    logger.info("kolafi-worker HTTP 端點啟動，port=%d", PORT)
    app.run(host='0.0.0.0', port=PORT)


if __name__ == '__main__':
    main()
