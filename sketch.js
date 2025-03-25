let gestureTracker,
  webcamFeed,
  detectedHands = [];
let canvasLayer;
let emojiButtons = [];
let emojiBursts = [];

let lastX = null;
let lastY = null;
let triggerTimestamps = {};
let gestureCooldown = 1000;

const PINCH_LIMIT = 20;

let resetBtn = { x: 20, y: 390, w: 100, h: 50 };

// 손 제스처 인식 모델 초기화
function preload() {
  gestureTracker = ml5.handPose();
}

// 웹캠 설정, UI 버튼 생성, 그래픽 레이어 구성
function setup() {
  createCanvas(640, 480);
  textFont("Noto Color Emoji, sans-serif");

  // 비디오 캡처 시작 및 설정
  webcamFeed = createCapture(
    {
      video: { width: 640, height: 480, facingMode: "user" },
    },
    () => console.log("카메라 연결 완료")
  );
  webcamFeed.size(640, 480);
  webcamFeed.hide();

  // 손 제스처 추적 시작
  gestureTracker.detectStart(webcamFeed, onHandUpdate);

  // 드로잉 레이어 생성
  canvasLayer = createGraphics(width, height);
  canvasLayer.clear();

  // 이모지 버튼 4개 생성 및 화면 중앙 정렬
  const emojis = ["😄", "😢", "😡", "😲"];
  const btnW = 80,
    spacing = 20;
  const totalW = btnW * emojis.length + spacing * (emojis.length - 1);
  const offsetX = (width - totalW) / 2;

  for (let i = 0; i < emojis.length; i++) {
    emojiButtons.push({
      icon: emojis[i],
      x: offsetX + i * (btnW + spacing),
      y: 10,
      w: btnW,
      h: 80,
    });
  }
}

// 프레임마다 실행되는 메인 루프
function draw() {
  background(240);

  // 웹캠 영상 좌우 반전 후 출력
  push();
  translate(width, 0);
  scale(-1, 1);
  image(webcamFeed, 0, 0, width, height);
  pop();

  // 드로잉 내용 출력
  image(canvasLayer, 0, 0);

  // UI 버튼 출력
  renderEmojiButtons();
  renderResetButton();

  // 손이 감지되었을 때만 작동
  if (detectedHands.length > 0) {
    let hand = detectedHands[0];
    let indexTip = hand.keypoints[8];
    let thumbTip = hand.keypoints[4];

    let ix = width - indexTip.x;
    let iy = indexTip.y;
    let tx = width - thumbTip.x;
    let ty = thumbTip.y;

    let distPinch = dist(ix, iy, tx, ty);
    let now = millis();

    // 핀치 제스처 드로잉
    if (distPinch < PINCH_LIMIT && iy > 100) {
      canvasLayer.stroke("red");
      canvasLayer.strokeWeight(4);
      if (lastX !== null && lastY !== null) {
        canvasLayer.line(lastX, lastY, ix, iy);
      }
      lastX = ix;
      lastY = iy;
    } else {
      lastX = null;
      lastY = null;

      handleEmojiPress(ix, iy, now);

      if (
        pointInBounds(ix, iy, resetBtn) &&
        (!triggerTimestamps["reset"] ||
          now - triggerTimestamps["reset"] > gestureCooldown)
      ) {
        resetCanvas();
        triggerTimestamps["reset"] = now;
      }
    }

    // 손가락 위치 시각화
    fill(255, 0, 0);
    noStroke();
    ellipse(ix, iy, 10);
  }

  animateEmojiBursts();
}

// 손 추적 결과가 업데이트될 때마다 실행되는 콜백 함수
function onHandUpdate(results) {
  detectedHands = results;
}

// 이모지 버튼 UI 출력
function renderEmojiButtons() {
  for (let btn of emojiButtons) {
    let hovered = detectedHands.length > 0 && isHovering(btn);

    fill(hovered ? "lightblue" : "white");
    stroke(0, 100);
    strokeWeight(hovered ? 3 : 1);
    rect(btn.x, btn.y, btn.w, btn.h, 20);

    textAlign(CENTER, CENTER);
    textSize(hovered ? 38 : 32);
    fill(0);
    text(btn.icon, btn.x + btn.w / 2, btn.y + btn.h / 2 - 10);

    textSize(14);
    fill(50);
    text(getEmojiMeaning(btn.icon), btn.x + btn.w / 2, btn.y + btn.h / 2 + 25);
  }
}

// 전체 삭제 버튼 UI 출력
function renderResetButton() {
  push();
  fill("#ffdddd");
  stroke(0);
  strokeWeight(1);
  rect(resetBtn.x, resetBtn.y, resetBtn.w, resetBtn.h, 10);

  fill(0);
  textAlign(CENTER, CENTER);
  textSize(14);
  text("전체 삭제", resetBtn.x + resetBtn.w / 2, resetBtn.y + resetBtn.h / 2);
  pop();
}

// 버튼 위에 손가락이 있는지 확인
function isHovering(btn) {
  let index = detectedHands[0].keypoints[8];
  let ix = width - index.x;
  let iy = index.y;
  return pointInBounds(ix, iy, btn);
}

// 좌표가 사각형 내부에 있는지 판단
function pointInBounds(x, y, box) {
  return x > box.x && x < box.x + box.w && y > box.y && y < box.y + box.h;
}

// 이모지에 해당하는 감정 텍스트 반환
function getEmojiMeaning(icon) {
  switch (icon) {
    case "😄":
      return "기쁨";
    case "😢":
      return "슬픔";
    case "😡":
      return "화남";
    case "😲":
      return "놀람";
    default:
      return "";
  }
}

// 손가락이 이모지 버튼을 누른 경우 반응 생성
function handleEmojiPress(x, y, time) {
  for (let btn of emojiButtons) {
    if (
      pointInBounds(x, y, btn) &&
      (!triggerTimestamps[btn.icon] ||
        time - triggerTimestamps[btn.icon] > gestureCooldown)
    ) {
      launchEmojiBurst(btn.icon);
      triggerTimestamps[btn.icon] = time;
    }
  }
}

// 이모지 애니메이션 생성 (튕기며 흔들림)
function launchEmojiBurst(icon) {
  emojiBursts.push({
    icon: icon,
    x: random(width),
    y: height - 10,
    vx: random(-1, 1),
    vy: random(-8, -10),
    gravity: 0.2,
    bounce: 0.6,
    alpha: 255,
    scale: 1.5,
    life: 0,
  });
}

// 이모지 애니메이션 처리 및 출력
function animateEmojiBursts() {
  for (let i = emojiBursts.length - 1; i >= 0; i--) {
    let b = emojiBursts[i];

    b.vy += b.gravity;
    b.x += sin(frameCount * 0.1 + i) * 1.5 + b.vx;
    b.y += b.vy;
    b.life++;

    if (b.y > height - 10) {
      b.y = height - 10;
      b.vy *= -b.bounce;
      b.vx *= 0.8;
    }

    if (b.life > 80) b.alpha -= 3;

    push();
    translate(b.x, b.y);
    scale(b.scale);
    fill(0, 0, 0, b.alpha);
    textSize(64);
    textAlign(CENTER, CENTER);
    text(b.icon, 0, 0);
    pop();

    if (b.alpha <= 0) {
      emojiBursts.splice(i, 1);
    }
  }
}

// 드로잉 보드 초기화
function resetCanvas() {
  canvasLayer.clear();
}
