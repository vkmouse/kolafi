FROM python:3.11-slim

# 系統依賴，合併自六個舊 worker 的 Dockerfile：
#   ffmpeg               THUMBNAIL/EXPORT：moviepy/ffmpeg-python 讀寫解碼、擷取影片幀需要
#   imagemagick           EXPORT：moviepy TextClip（字幕）底層透過 ImageMagick 繪製文字
#   libsm6/libxext6        THUMBNAIL/EXPORT：Pillow 處理某些圖片格式需要
#   fonts-noto-cjk 等      EXPORT：字幕預設字型 Noto-Sans-CJK-TC-Bold 等中文字型
RUN apt-get update && apt-get install -y \
    ffmpeg \
    imagemagick \
    libsm6 \
    libxext6 \
    fonts-noto-cjk \
    fonts-noto-cjk-extra \
    fonts-arphic-uming \
    fonts-arphic-ukai \
    fonts-wqy-zenhei \
    && rm -rf /var/lib/apt/lists/*

# ImageMagick 預設 policy 禁止 TEXT / @* pattern（會導致 moviepy TextClip 直接失敗），
# 沿用原本 export-worker/Dockerfile 的做法解除限制
RUN for p in /etc/ImageMagick-6/policy.xml /etc/ImageMagick-7/policy.xml; do \
      if [ -f "$p" ]; then \
        sed -i \
          -e 's/rights="none" pattern="TEXT"/rights="read|write" pattern="TEXT"/' \
          -e 's/rights="none" pattern="@\*"/rights="read|write" pattern="@*"/' \
          "$p"; \
      fi; \
    done

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Image 比任何一個原本的單一 worker 都大，是合併六種任務類型系統依賴換來的取捨。
EXPOSE 8080

ENV PYTHONUNBUFFERED=1

CMD ["python", "main.py"]
