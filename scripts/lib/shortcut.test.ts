import { describe, expect, it } from "vitest";
import { buildShortcutPlist, shortcutDefinition } from "./shortcut.ts";

type Action = {
  WFWorkflowActionIdentifier: string;
  WFWorkflowActionParameters: Record<string, unknown>;
};

const definition = shortcutDefinition("https://example.test/api/inbox") as {
  WFWorkflowActions: Action[];
  WFWorkflowImportQuestions: {
    ActionIndex: number;
    ParameterKey: string;
  }[];
};
const actions = definition.WFWorkflowActions;
const ids = actions.map((a) => a.WFWorkflowActionIdentifier);
const uuidOf = (id: string) =>
  actions.find((a) => a.WFWorkflowActionIdentifier === id)
    ?.WFWorkflowActionParameters.UUID;

describe("команда iOS «скриншот → Word Drill»", () => {
  it("ключ → снимок → распознать текст → отправить → уведомление, именно в таком порядке", () => {
    expect(ids).toEqual([
      "is.workflow.actions.gettext",
      "is.workflow.actions.takescreenshot",
      "is.workflow.actions.extracttextfromimage",
      "is.workflow.actions.downloadurl",
      "is.workflow.actions.notification",
    ]);
  });

  it("при установке спрашивает ключ в первое действие «Текст»", () => {
    expect(definition.WFWorkflowImportQuestions).toEqual([
      expect.objectContaining({
        ActionIndex: 0,
        ParameterKey: "WFTextActionText",
      }),
    ]);
  });

  it("отправляет распознанный текст с ключом из первого действия", () => {
    const request = JSON.stringify(actions[3]?.WFWorkflowActionParameters);
    expect(request).toContain('"WFURL":"https://example.test/api/inbox"');
    expect(request).toContain('"WFHTTPMethod":"POST"');
    expect(request).toContain('"string":"Bearer ￼"');
    expect(request).toContain(
      `"OutputUUID":"${uuidOf("is.workflow.actions.gettext")}"`,
    );
    expect(request).toContain(
      `"OutputUUID":"${uuidOf("is.workflow.actions.extracttextfromimage")}"`,
    );
    const extract = JSON.stringify(actions[2]?.WFWorkflowActionParameters);
    expect(extract).toContain(
      `"OutputUUID":"${uuidOf("is.workflow.actions.takescreenshot")}"`,
    );
  });

  it("plist: экранирует XML", () => {
    const xml = buildShortcutPlist("https://example.test/api/inbox?a=1&b=2");
    expect(xml).toContain("a=1&amp;b=2");
    expect(xml.startsWith("<?xml")).toBe(true);
  });
});
