import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

document.addEventListener("gesturestart", function (e) {
  e.preventDefault();
});

document.addEventListener("ontouchstart", function (e) {
  e.preventDefault();
});

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
