import "@testing-library/jest-dom/vitest";

// jsdom은 window.scrollTo를 구현하지 않아 호출할 때마다 "Not implemented" 경고를
// 콘솔에 찍는다 — HomeClient가 결과 화면 진입 시 이걸 호출하므로 테스트에서만 no-op으로 스텁.
window.scrollTo = () => {};
