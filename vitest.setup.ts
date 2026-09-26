import { beforeEach } from "vitest";

// Every test starts from an empty browser store; nothing leaks between tests.
beforeEach(() => {
  localStorage.clear();
});
