import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import HelloWorld from "./HelloWorld.vue";

describe("HelloWorld Component", () => {
  it("renders the default message", () => {
    const wrapper = mount(HelloWorld);
    expect(wrapper.find("h1").text()).toBe("Hello World");
  });

  it("renders a custom message", () => {
    const customMessage = "Custom Message";
    const wrapper = mount(HelloWorld, {
      props: {
        message: customMessage,
      },
    });
    expect(wrapper.find("h1").text()).toBe(customMessage);
  });

  it("increments counter when button is clicked", async () => {
    const wrapper = mount(HelloWorld);
    const button = wrapper.find("button");

    // Initial state
    expect(button.text()).toContain("Count: 0");

    // Click the button
    await button.trigger("click");

    // Check if counter incremented
    expect(button.text()).toContain("Count: 1");

    // Click again
    await button.trigger("click");

    // Check if counter incremented again
    expect(button.text()).toContain("Count: 2");
  });
});
