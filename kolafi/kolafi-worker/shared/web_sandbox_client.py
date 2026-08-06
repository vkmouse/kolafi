"""
web-sandbox HTTP API 的簡易 client。

web-sandbox 是跑在區網內某台 Windows 主機上的桌面程式（非 docker-compose service），
透過 HTTP + Bearer Token 遙控它開出來的分頁。

三個必要的環境變數：
- WEB_SANDBOX_BASE_URL：web-sandbox 主機位址，例如 `http://192.168.1.50:9000`
- WEB_SANDBOX_TOKEN：存取用的 Bearer Token
- WEB_SANDBOX_PROFILE_ID：web-sandbox 桌面程式裡建立好的 profile id（整數）
"""

import os

import requests


class WebSandboxError(Exception):
    """web-sandbox API 呼叫失敗（HTTP 錯誤狀態碼或連線層級錯誤）。"""


class WebSandboxClient:
    """遙控 web-sandbox 開出的單一分頁（session）。"""

    def __init__(self, base_url=None, token=None, profile_id=None, timeout=15):
        self.base_url = (base_url or os.getenv('WEB_SANDBOX_BASE_URL', '')).rstrip('/')
        self.token = token if token is not None else os.getenv('WEB_SANDBOX_TOKEN', '')

        if profile_id is None:
            profile_id = os.getenv('WEB_SANDBOX_PROFILE_ID')
        if not self.base_url or not self.token or profile_id is None:
            raise WebSandboxError(
                '缺少 web-sandbox 連線設定，請確認環境變數 '
                'WEB_SANDBOX_BASE_URL / WEB_SANDBOX_TOKEN / WEB_SANDBOX_PROFILE_ID 皆已設定'
            )
        self.profile_id = int(profile_id)

        self.timeout = timeout
        self._http = requests.Session()
        self._http.headers.update({'Authorization': f'Bearer {self.token}'})

    def _request(self, method, path, json_body=None, ok_statuses=(200, 204)):
        url = f'{self.base_url}{path}'
        resp = self._http.request(method, url, json=json_body, timeout=self.timeout)
        if resp.status_code not in ok_statuses:
            raise WebSandboxError(
                f'{method} {path} 失敗 (HTTP {resp.status_code}): {_error_detail(resp)}'
            )
        return resp

    def open_session(self, url):
        """開新分頁並直接導航到 url，回傳 session_id。"""
        resp = self._request('POST', '/sessions', {'profile_id': self.profile_id, 'url': url})
        return resp.json()['session_id']

    def switch_url(self, session_id, url):
        """在同一個 session 內切換網址。"""
        self._request(
            'POST',
            f'/sessions/{session_id}/url',
            {'profile_id': self.profile_id, 'url': url},
        )

    def find_elements(self, session_id, selector, parent_element_id=None):
        """回傳符合 CSS selector 的 element_id 列表（可能為空列表）。"""
        body = {'profile_id': self.profile_id, 'selector': selector}
        if parent_element_id is not None:
            body['parent_element_id'] = parent_element_id
        resp = self._request('POST', f'/sessions/{session_id}/elements', body)
        return resp.json()['element_ids']

    def find_element(self, session_id, selector, parent_element_id=None):
        """回傳符合 CSS selector 的單一 element_id；找不到則回傳 None。"""
        body = {'profile_id': self.profile_id, 'selector': selector}
        if parent_element_id is not None:
            body['parent_element_id'] = parent_element_id
        try:
            resp = self._request('POST', f'/sessions/{session_id}/element', body, ok_statuses=(200,))
        except WebSandboxError as e:
            if '404' in str(e):
                return None
            raise
        return resp.json()['element_id']

    def get_attribute(self, session_id, element_id, name):
        """讀取元素的某個屬性值；元素沒有該屬性時回傳 None。"""
        resp = self._request(
            'POST',
            f'/sessions/{session_id}/element/{element_id}/attribute',
            {'profile_id': self.profile_id, 'name': name},
        )
        return resp.json()['value']

    def click_element(self, session_id, element_id):
        self._request(
            'POST',
            f'/sessions/{session_id}/element/{element_id}/click',
            {'profile_id': self.profile_id},
            ok_statuses=(204,),
        )

    def close_session(self, session_id):
        """關閉分頁；session 已經不存在時視為成功。"""
        self._request(
            'DELETE',
            f'/sessions/{session_id}',
            {'profile_id': self.profile_id},
            ok_statuses=(204, 404),
        )


def _error_detail(resp):
    try:
        return resp.json().get('error', resp.text)
    except ValueError:
        return resp.text
