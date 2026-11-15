interface BIPEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

let deferred: BIPEvent | null = null;

export function setupInstallGuide(banner: HTMLElement, btn: HTMLButtonElement, text: HTMLElement) {
  const standalone = matchMedia("(display-mode: standalone)").matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone || localStorage.getItem("installDismissed")) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);

  if (isIOS) {
    // iOS 는 설치 프롬프트가 없음 → 수동 안내
    text.textContent = "Safari 하단 공유(⬆) 버튼 → \"홈 화면에 추가\" 를 누르면 앱처럼 쓸 수 있어요.";
    btn.hidden = true;
    banner.hidden = false;
  } else {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferred = e as BIPEvent;
      text.textContent = "홈 화면에 추가하면 앱처럼 바로 열 수 있어요.";
      btn.hidden = false;
      banner.hidden = false;
    });
    btn.addEventListener("click", async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      banner.hidden = true;
    });
  }
  banner.querySelector<HTMLButtonElement>("[data-dismiss]")?.addEventListener("click", () => {
    localStorage.setItem("installDismissed", "1");
    banner.hidden = true;
  });
}
