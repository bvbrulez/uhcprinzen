export function createLatestRequestGate() {
  let currentId = 0;
  return {
    begin() {
      currentId += 1;
      return currentId;
    },
    invalidate() {
      currentId += 1;
    },
    isCurrent(requestId) {
      return requestId === currentId;
    },
  };
}
