// Heavily adapted from https://raw.githubusercontent.com/hammerjs/simulator/60f43a021a92cadfcb48126f8aba819020f6bcb7/index.js

function trigger(touch, element, eventType) {
  const { x, y } = touch;
  touch.clientX = x;
  touch.clientY = y;

  const id = (Math.random * Number.MAX_SAFE_INTEGER) | 0;

  const event = new Event(eventType, {
    bubbles: true,
    buttons: 1,
    cancelable: true,
    clientX: x,
    clientY: y,
    getCurrentPoint: () => touch,
    identifier: id,
    pageX: x,
    pageY: y,
    pointerId: id,
    pointerType: "touch",
    releasePointerCapture: () => {},
    screenX: x,
    screenY: y,
    setPointerCapture: () => {},
    target: element,
  });

  // we can't bind these through the Event constructor...
  Object.defineProperty(event, `touches`, {
    value: {
      length: 1,
      0: touch,
      get: () => touch,
    },
    writable: false,
  });

  // Fire!
  element.dispatchEvent(event);
}

export /* async */ function drag(from, to) {
  const { left, width, top } = from.getBoundingClientRect();
  const touch = { x: left + width / 2, y: top + 1, target: from };
  trigger(touch, from, "touchstart");

  const steps = 10;
  const [dx, dy] = (function (l, t) {
    const { left, top } = to.getBoundingClientRect();
    return [left - l, top - t].map((v) => v / steps);
  })(left, top);

  return new Promise((resolve) => {
    function drag(i = 0) {
      if (i === steps - 1) {
        trigger(touch, to, "touchend");
        setTimeout(resolve, 25);
      }
      touch.x += dx;
      touch.y += dy;
      touch.target = document;
      trigger(touch, to, "touchmove");
      setTimeout(() => drag(i + 1), 100 / steps);
    }

    drag();
  });
}

export /* async */ function tap(element) {
  const { left, width, top } = element.getBoundingClientRect();
  const touch = { x: left + width / 2, y: top + 1, target: element };
  trigger(touch, element, "touchstart");

  return new Promise((resolve) => {
    setTimeout(function () {
      trigger(touch, element, "touchend");
      setTimeout(resolve, 25);
    }, 100);
  });
}
