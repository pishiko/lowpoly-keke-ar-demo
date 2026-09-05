export class CameraFeed {
  constructor(video) { this.video = video; this.stream = null; this.facing = 'environment'; this.mirrored = false; this.generation = 0; }
  stop() {
    this.generation++;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null; this.video.srcObject = null; this.video.hidden = true;
  }
  async start(facing = this.facing) {
    this.stop();
    const generation = this.generation;
    if (!window.isSecureContext) throw new Error('カメラを使うにはHTTPSで開いてください。PCでのお試しはlocalhostでも利用できます。');
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('このブラウザではカメラを利用できません。別のブラウザで開いてください。');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (generation !== this.generation) { stream.getTracks().forEach((t) => t.stop()); return false; }
      this.stream = stream; this.video.srcObject = stream;
      await this.video.play();
      if (generation !== this.generation) return false;
      this.facing = stream.getVideoTracks()[0].getSettings().facingMode || facing;
      this.mirrored = this.facing === 'user';
      this.video.classList.toggle('mirrored', this.mirrored); this.video.hidden = false;
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      this.stop();
      const messages = {
        NotAllowedError: 'カメラが許可されていません。ブラウザのサイト設定でカメラを許可して、もう一度お試しください。',
        NotFoundError: 'カメラが見つかりませんでした。スタジオではそのまま遊べます。',
        NotReadableError: 'カメラを起動できません。他のカメラアプリを閉じて、もう一度お試しください。',
        OverconstrainedError: 'このカメラ設定を利用できません。別のカメラでお試しください。',
      };
      throw new Error(messages[error.name] || 'カメラを開始できませんでした。もう一度お試しください。');
    }
  }
  draw(context, width, height) {
    const video = this.video;
    if (!this.stream || video.readyState < 2 || !video.videoWidth) throw new Error('カメラ映像を準備中です。少し待ってから撮影してください。');
    const scale = Math.max(width / video.videoWidth, height / video.videoHeight);
    const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
    context.save();
    if (this.mirrored) { context.translate(width, 0); context.scale(-1, 1); }
    context.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh);
    context.restore();
  }
}
