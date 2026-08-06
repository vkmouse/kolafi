"""
Worker 框架邏輯：開機 Pull 一次、處理完立刻再 Pull、沒任務時等待（直到收到 notify()
或閒置逾時保底輪詢）。每種任務類型只有 1 個實例，不處理多消費者鎖定問題。

框架不知道任何任務類型的業務邏輯，都交給呼叫端傳入的 process_task callback。
不自己開 HTTP 端點，/notify、/healthz 統一由 coordinator（main.py）提供。

用法：

    from worker_framework import WorkerFramework

    def process_task(task_data: dict, client: TaskApiClient) -> None:
        ...
        client.ack(task_id, {...})

    framework = WorkerFramework('thumbnail', process_task)
    threading.Thread(target=framework.run_loop, daemon=True).start()
    ...
    framework.notify()   # 收到 /notify/thumbnail 時呼叫
"""
import os
import threading
import time
from typing import Callable

from logger import get_logger
from task_api_client import TaskApiClient, TaskApiError

ProcessTaskFn = Callable[[dict, TaskApiClient], None]


class WorkerFramework:
    def __init__(
        self,
        task_type: str,
        process_task: ProcessTaskFn,
        *,
        idle_poll_interval_seconds: int = None,
        api_error_backoff_seconds: int = None,
    ):
        self.task_type = task_type
        self.process_task = process_task
        self.client = TaskApiClient(task_type)

        self.idle_poll_interval_seconds = idle_poll_interval_seconds or int(
            os.environ.get('IDLE_POLL_INTERVAL_SECONDS', '600')
        )
        self.api_error_backoff_seconds = api_error_backoff_seconds or int(
            os.environ.get('API_ERROR_BACKOFF_SECONDS', '5')
        )

        self.logger = get_logger(f'{task_type}-worker')

        # 忙碌時 set 也無妨：當下任務處理完，主迴圈本來就會立刻再 Pull 一次
        self._notify_event = threading.Event()

    def notify(self) -> None:
        """喚醒這個任務類型的迴圈。"""
        self._notify_event.set()

    def _pull_and_process_once(self) -> bool:
        """回傳 True 代表該立刻再 Pull 一次；False 代表沒任務，該進入等待。"""
        try:
            data = self.client.pull()
        except TaskApiError as e:
            self.logger.error("Pull 失敗，%d 秒後重試: %s", self.api_error_backoff_seconds, e)
            time.sleep(self.api_error_backoff_seconds)
            return True

        if data is None:
            return False

        try:
            self.process_task(data, self.client)
        except Exception:
            # 保底：process_task 理論上該自己吞掉錯誤並 ack(FAILED)，這裡代表它沒做到，
            # 代價是任務卡在 PROCESSING
            self.logger.exception("[%s] process_task 發生未預期例外，這筆任務會卡在 PROCESSING", self.task_type)

        return True

    def run_loop(self) -> None:
        """主迴圈本體：跑在背景 thread 裡，直到 process 結束才停。"""
        self.logger.info("%s Worker 主迴圈啟動", self.task_type)
        while True:
            if self._pull_and_process_once():
                continue

            self.logger.info(
                "沒有任務可拿，進入閒置等待（最長 %d 秒或直到收到 notify）",
                self.idle_poll_interval_seconds,
            )
            self._notify_event.wait(timeout=self.idle_poll_interval_seconds)
            self._notify_event.clear()
