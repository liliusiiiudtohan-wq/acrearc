import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost/",
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  localStorage: dom.window.localStorage,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  MutationObserver: dom.window.MutationObserver,
  getComputedStyle: dom.window.getComputedStyle,
});
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
const React = await import("react");
const { render, screen, within, waitFor, fireEvent, cleanup } =
  await import("@testing-library/react");
const userEvent = (await import("@testing-library/user-event")).default;
const { default: App } = await import("../src/App");
let providerCalls = 0;
const requests: string[] = [];
globalThis.fetch = (async (input: any, { signal }: any = {}) => {
  const path = String(input);
  requests.push(path);
  if (path.startsWith("https:")) {
    providerCalls++;
    throw Error("Provider access disabled for offline verification");
  }
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const text = await readFile(
    new URL("../public/" + path.replace(/^\//, ""), import.meta.url),
    "utf8",
  );
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}) as typeof fetch;
const app = () => within(document.querySelector(".app-screen") as HTMLElement);
const nav = (label: string) =>
  within(screen.getByRole("navigation", { name: "Main navigation" })).getByRole(
    "button",
    { name: label },
  );
test("provider-disabled complete prototype workflow across both regions, example panels and brief", async () => {
  const user = userEvent.setup({ document: dom.window.document });
  render(React.createElement(App));
  await screen.findByText("Find a town or area");
  await user.click(app().getByText("Find a town or area"));
  assert.equal(
    (app().getByLabelText("Town sample") as HTMLSelectElement).value,
    "",
  );
  assert.ok(app().getByRole("img", { name: /full Murray–Darling Basin/ }));
  await user.click(app().getByText("Pin or draw with keyboard"));
  fireEvent.change(app().getByLabelText("Latitude"), {
    target: { value: "-34" },
  });
  fireEvent.change(app().getByLabelText("Longitude"), {
    target: { value: "146" },
  });
  await user.click(app().getByRole("button", { name: "Drop coordinate pin" }));
  assert.ok(app().getByRole("img", { name: /Pin -34.000, 146.000/ }));
  assert.ok(app().getAllByText(/no measured aggregate/).length);
  fireEvent.change(app().getByLabelText("Polygon [lon, lat] pairs"), {
    target: { value: "[[146,-34],[146.1,-34],[146.1,-34.1]]" },
  });
  await user.click(app().getByRole("button", { name: "Use drawn area" }));
  assert.ok(app().getByRole("img", { name: /Drawn planning area/ }));
  await user.click(app().getByRole("button", { name: "North · Dalby" }));
  await waitFor(() => assert.ok(app().getByText(/NASA POWER · Dalby/)));
  assert.ok(app().getAllByText(/Northern Basin/).length);
  await app().findByText(/3653 \/ 3653/);
  await user.selectOptions(
    app().getByLabelText("Basin region"),
    "Southern Basin",
  );
  assert.equal(
    (app().getByLabelText("Town sample") as HTMLSelectElement).value,
    "",
  );
  await user.selectOptions(app().getByLabelText("Town sample"), "griffith");
  await waitFor(() => assert.ok(app().getByText(/NASA POWER · Griffith/)));
  assert.ok(app().getAllByText(/Murrumbidgee/).length);
  await user.selectOptions(
    app().getByLabelText("Basin region"),
    "Southern Basin",
  );
  await user.selectOptions(app().getByLabelText("Town sample"), "mildura");
  await waitFor(() => assert.ok(app().getByText(/NASA POWER · Mildura/)));
  await user.selectOptions(
    app().getByLabelText("Basin region"),
    "Southern Basin",
  );
  await user.selectOptions(app().getByLabelText("Town sample"), "leeton");
  await waitFor(() =>
    assert.ok(app().getByText(/No bundled real series here/)),
  );
  await user.click(
    app().getByRole("button", { name: "Load supported sample" }),
  );
  await waitFor(() => assert.ok(app().getByText(/NASA POWER · Griffith/)));
  // Rapid north/south selection must finish with Griffith's values.
  fireEvent.change(app().getByLabelText("Basin region"), {
    target: { value: "Northern Basin" },
  });
  fireEvent.change(app().getByLabelText("Town sample"), {
    target: { value: "dalby" },
  });
  fireEvent.change(app().getByLabelText("Basin region"), {
    target: { value: "Southern Basin" },
  });
  fireEvent.change(app().getByLabelText("Town sample"), {
    target: { value: "griffith" },
  });
  await waitFor(() => assert.ok(app().getByText(/NASA POWER · Griffith/)));
  await user.click(app().getByRole("button", { name: /Optional keyless/ }));
  await waitFor(() => assert.ok(app().getByText(/Recent request failed/)));
  assert.equal(providerCalls, 1);
  await user.click(nav("Compare rotations"));
  await user.click(app().getByRole("button", { name: "Balanced priorities" }));
  await user.click(
    app().getByRole("button", { name: "Use example cereal baseline" }),
  );
  assert.equal(
    (app().getByLabelText("Plan B") as HTMLSelectElement).options.length,
    8,
  );
  assert.ok(app().getByText(/Needs evidence: Soil suitability/));
  await user.click(
    app().getByRole("button", { name: "Compare with available evidence" }),
  );
  assert.equal(app().getAllByText("Partial draft fit").length, 2);
  await user.click(
    app().getByRole("button", { name: "Require all priorities" }),
  );
  await user.click(nav("Explore the basin"));
  await user.selectOptions(app().getByLabelText("Data mode"), "example");
  await waitFor(() =>
    assert.ok(app().getByText(/Synthetic interaction fixtures/)),
  );
  assert.ok(app().getAllByText(/SYNTHETIC/).length);
  await user.click(app().getByRole("tab", { name: "Rainfall & drought" }));
  assert.ok(app().getByText("7-day rainfall"));
  assert.ok(app().getByRole("heading", { name: /IMERG Final — separate/ }));
  await user.click(
    app().getAllByRole("button", { name: "Show accessible table" })[0],
  );
  assert.ok(app().getAllByRole("table").length);
  await user.click(app().getByRole("tab", { name: "Heat & temperature" }));
  fireEvent.change(app().getByLabelText("Risk window end"), {
    target: { value: "2025-11-17" },
  });
  assert.ok(app().getByText("Longest hot streak"));
  await user.click(app().getByRole("tab", { name: "Soil moisture" }));
  await user.click(app().getByRole("button", { name: "Surface · 0–5 cm" }));
  await user.click(app().getByRole("button", { name: "3D value height" }));
  assert.ok(app().getByText(/pitched columns/));
  await user.click(app().getByRole("button", { name: "Fit data footprint" }));
  await user.click(app().getByRole("tab", { name: "Surface flooding" }));
  assert.equal(
    document.querySelectorAll(".app-screen .flood-grid>span").length,
    100,
  );
  assert.ok(document.querySelector(".flood-grid .masked"));
  assert.ok(document.querySelector(".flood-grid .permanent"));
  assert.ok(document.querySelector(".flood-grid .new-water"));
  await user.selectOptions(
    app().getByLabelText("Comparison observation"),
    "reference",
  );
  assert.equal(document.querySelector(".flood-grid .new-water"), null);
  await user.selectOptions(
    app().getByLabelText("Comparison observation"),
    "event",
  );
  assert.ok(document.querySelector(".flood-grid .new-water"));
  await user.click(app().getByRole("tab", { name: "Vegetation decline" }));
  const divider = app().getByLabelText("Before after imagery divider");
  divider.focus();
  assert.equal(document.activeElement, divider);
  fireEvent.change(divider, { target: { value: "70" } });
  assert.ok(app().getByText("70% before"));
  await user.selectOptions(app().getByLabelText("Vegetation after date"), "1");
  assert.ok(app().getByText(/no usable after image/));
  await user.click(nav("Compare rotations"));
  await user.click(app().getByRole("button", { name: "Back" }));
  await user.click(app().getByText("Edit farm inputs or enter your own plan"));
  await user.selectOptions(app().getByLabelText("Baseline year 1"), "barley");
  assert.equal(
    (app().getByLabelText("Baseline year 1") as HTMLSelectElement).value,
    "barley",
  );
  await user.click(
    app().getByRole("button", { name: "Compare plans" }),
  );
  await user.selectOptions(app().getByLabelText("Plan B"), "summer");
  await user.click(app().getByText("Fine-tune priorities"));
  // Soil range for forage is unknown: zero that priority to demonstrate valid common-evidence ranking.
  fireEvent.change(app().getByLabelText("Support soil & nitrogen"), {
    target: { value: "0" },
  });
  await waitFor(() =>
    assert.ok(!app().queryByText(/Ranking unavailable for this evidence set/)),
  );
  const selectedRow = app()
    .getByRole("heading", { name: "Opportunity forage" })
    .closest("article")!;
  await user.click(
    within(selectedRow).getByRole("button", { name: "Use this plan" }),
  );
  fireEvent.change(app().getByLabelText("Conserve water"), {
    target: { value: "9" },
  });
  assert.equal(
    within(
      app()
        .getByRole("heading", { name: "Opportunity forage" })
        .closest("article")!,
    )
      .getByRole("button", { name: "Selected" })
      .getAttribute("aria-pressed"),
    "true",
  );
  for (const label of [
    "Conserve water",
    "Support soil & nitrogen",
    "Reduce erosion",
    "Crop / market fit",
  ])
    fireEvent.change(app().getByLabelText(label), { target: { value: "0" } });
  assert.ok(app().getByText(/All priorities are zero/));
  for (const label of ["Conserve water", "Reduce erosion", "Crop / market fit"])
    fireEvent.change(app().getByLabelText(label), { target: { value: "5" } });
  await user.click(app().getByText("Edit farm inputs", { exact: true }));
  await user.selectOptions(
    app().getByLabelText("Example October moisture case"),
    "low",
  );
  assert.ok(app().getAllByText(/Fallow/).length);
  await user.selectOptions(
    app().getByLabelText("Example October moisture case"),
    "unknown",
  );
  await user.selectOptions(
    app().getByLabelText("Example October moisture case"),
    "high",
  );
  await user.click(nav("Future estimates"));
  const baselineText = document.querySelector(
    ".future-panel tbody",
  )!.textContent;
  await user.click(
    app().getByRole("button", { name: "Illustrative 2050 preset" }),
  );
  assert.notEqual(
    document.querySelector(".future-panel tbody")!.textContent,
    baselineText,
  );
  assert.ok(app().getByText(/Scenario active in planning/));
  await user.click(app().getByRole("button", { name: "Reset scenario" }));
  assert.equal(
    document.querySelector(".future-panel tbody")!.textContent,
    baselineText,
  );
  await user.click(nav("Farm brief"));
  assert.ok(app().getByRole("heading", { name: "Griffith" }));
  assert.ok(app().getByText("EXAMPLE MODE — SYNTHETIC EVIDENCE"));
  assert.equal(
    document.querySelectorAll(".app-screen .calendar-months .month").length,
    36,
  );
  assert.ok(document.querySelector(".app-screen .month.harvest"));
  assert.ok(app().getByRole("heading", { name: "Regional guidance" }));
  assert.ok(app().getByRole("button", { name: "Print / Save as PDF" }));
  let printed = 0;
  window.print = () => {
    printed++;
  };
  await user.click(app().getByRole("button", { name: "Print / Save as PDF" }));
  assert.equal(printed, 1);
  assert.ok(
    document
      .querySelector(".print-only")
      ?.textContent?.includes("Opportunity forage"),
  );
  assert.ok(
    document.querySelector(".print-only")?.textContent?.includes("Griffith"),
  );
  // All controls used bundled assets only except the explicit failed refresh.
  assert.equal(providerCalls, 1);
  assert.ok(requests.filter((p) => p.includes("/example/")).length > 0);
  await user.click(app().getByRole("button", { name: "About the science" }));
  assert.ok(screen.getByRole("dialog"));
  await user.keyboard("{Escape}");
  assert.equal(screen.queryByRole("dialog"), null);
  await user.click(nav("Explore the basin"));
  await user.selectOptions(app().getByLabelText("Data mode"), "real");
  await user.click(app().getByRole("tab", { name: "Historical analysis" }));
  await waitFor(() => assert.ok(app().getByText(/3653 \/ 3653/)));
  await user.click(nav("Farm brief"));
  assert.ok(
    app().getByText(
      "REAL-DATA MODE — POWER WEATHER + DRAFT PLANNING ASSUMPTIONS",
    ),
  );
  assert.ok(
    !document
      .querySelector(".print-only")
      ?.textContent?.includes("SYNTHETIC EVIDENCE"),
  );
  assert.ok(
    !document
      .querySelector(".print-only")
      ?.textContent?.includes("0.300 m³/m³"),
  );
  cleanup();
  dom.window.close();
});
