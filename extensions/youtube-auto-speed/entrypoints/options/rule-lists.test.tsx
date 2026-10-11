// @vitest-environment happy-dom
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { ChannelRule, TitleRule } from "@/utils/rules";

import { ChannelRules } from "./channel-rules";
import { TitleRules } from "./title-rules";

// Without it, React warns that this environment does not support `act`.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function Lists(props: { channelRules: ChannelRule[]; titleRules: TitleRule[] }) {
  const [titleRules, setTitleRules] = useState(props.titleRules);
  const [channelRules, setChannelRules] = useState(props.channelRules);
  return (
    <>
      <TitleRules rules={titleRules} onChange={setTitleRules} />
      <ChannelRules names={{}} rules={channelRules} onChange={setChannelRules} />
    </>
  );
}

let root: Root;

function render(props: { channelRules?: ChannelRule[]; titleRules?: TitleRule[] }) {
  root = createRoot(document.body.appendChild(document.createElement("div")));
  act(() => root.render(<Lists channelRules={[]} titleRules={[]} {...props} />));
}

function button(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find(
    (each) => (each.getAttribute("aria-label") ?? each.textContent) === name,
  );
  if (!found) throw new Error(`no button ${name}`);
  return found;
}

function values(label: string): string[] {
  return [...document.querySelectorAll("label")]
    .filter((each) => each.querySelector(".sr-only")?.textContent?.startsWith(label))
    .map((each) => each.querySelector<HTMLInputElement | HTMLSelectElement>("input, select"))
    .map((field) => field?.value ?? "");
}

function select(label: string): HTMLSelectElement {
  const found = [...document.querySelectorAll("label")]
    .find((each) => each.querySelector(".sr-only")?.textContent === label)
    ?.querySelector("select");
  if (!found) throw new Error(`no select ${label}`);
  return found;
}

/** A pointer press, which reaches the document before the click does. */
function press(target: HTMLElement) {
  act(() => {
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    target.click();
  });
}

const asmr: TitleRule = { id: "t1", pattern: "asmr", speed: 1 };
const lofi: TitleRule = { id: "t2", pattern: "lofi", speed: 1 };
const lisp: ChannelRule = { handle: "@dailylisp", id: "c1", speed: 2 };
const cook: ChannelRule = { handle: "@slowcook", id: "c2", speed: 1.5 };

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
});

describe("rule lists", () => {
  it("add a blank rule and focus its field", () => {
    render({ channelRules: [lisp], titleRules: [asmr] });
    press(button("Add title rule"));
    expect(values("Title pattern")).toEqual(["asmr", ""]);
    expect(document.activeElement).toBe(document.querySelectorAll("input")[1]);
    press(button("Add channel rule"));
    expect(values("Channel handle")).toEqual(["@dailylisp", ""]);
    expect(document.activeElement).toBe(document.querySelectorAll("input")[3]);
  });

  it("change only the rule that was edited", () => {
    render({ channelRules: [lisp, cook], titleRules: [asmr, lofi] });
    act(() => {
      const field = select("Speed for title rule lofi");
      field.value = "2.5";
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(values("Speed for title rule")).toEqual(["1", "2.5"]);
    act(() => {
      const field = select("Speed for channel rule @slowcook");
      field.value = "3";
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(values("Speed for channel rule")).toEqual(["2", "3"]);
  });

  it("delete a rule on the second click, then return focus to Add", () => {
    render({ channelRules: [lisp, cook], titleRules: [asmr, lofi] });
    press(button("Delete title rule asmr"));
    expect(button("Delete title rule lofi").dataset.armed).toBeUndefined();
    expect(values("Title pattern")).toEqual(["asmr", "lofi"]);
    press(button("Confirm deleting title rule asmr"));
    expect(values("Title pattern")).toEqual(["lofi"]);
    expect(document.activeElement).toBe(button("Add title rule"));

    press(button("Delete channel rule @dailylisp"));
    expect(button("Delete channel rule @slowcook").dataset.armed).toBeUndefined();
    press(button("Confirm deleting channel rule @dailylisp"));
    expect(values("Channel handle")).toEqual(["@slowcook"]);
    expect(document.activeElement).toBe(button("Add channel rule"));
  });

  it("let only one Delete wait for its second click, across both lists", () => {
    render({ channelRules: [lisp], titleRules: [asmr] });
    press(button("Delete title rule asmr"));
    press(button("Delete channel rule @dailylisp"));
    expect(button("Delete title rule asmr").dataset.armed).toBeUndefined();
    expect(button("Confirm deleting channel rule @dailylisp").dataset.armed).toBe("true");
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(button("Delete channel rule @dailylisp").dataset.armed).toBeUndefined();
  });
});
