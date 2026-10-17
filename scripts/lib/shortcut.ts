// Описание команды iOS «Команды» в формате plist (до подписи) — scripts/build-shortcut.ts.
// Действия связаны по UUID: каждое берёт результат предыдущего («Магические переменные»).

const KEY = "0B5F4E1A-6C2D-4D0E-9A11-3F1E5C7A2B01";
const SCREENSHOT = "1C6A5F2B-7D3E-4E1F-8B22-4A2F6D8B3C02";
const TEXT = "2D7B6A3C-8E4F-4F2A-9C33-5B3A7E9C4D03";

type Plist = string | number | boolean | Plist[] | { [key: string]: Plist };

function output(uuid: string, name: string): Plist {
  return { OutputUUID: uuid, Type: "ActionOutput", OutputName: name };
}

/** Переменная целиком (поле «Изображение», «Текст»). */
function variable(uuid: string, name: string): Plist {
  return {
    Value: output(uuid, name),
    WFSerializationType: "WFTextTokenAttachment",
  };
}

/** Текст со вставленной переменной на месте символа U+FFFC. */
function tokenString(text: string, uuid?: string, name?: string): Plist {
  const at = text.indexOf("￼");
  return {
    Value: {
      string: text,
      attachmentsByRange:
        uuid && name && at >= 0 ? { [`{${at}, 1}`]: output(uuid, name) } : {},
    },
    WFSerializationType: "WFTextTokenString",
  };
}

function dictionaryField(items: [string, Plist][]): Plist {
  return {
    Value: {
      WFDictionaryFieldValueItems: items.map(([key, value]) => ({
        WFItemType: 0,
        WFKey: tokenString(key),
        WFValue: value,
      })),
    },
    WFSerializationType: "WFDictionaryFieldValue",
  };
}

export function shortcutDefinition(inboxUrl: string): Plist {
  return {
    WFWorkflowClientVersion: "2607.0.2",
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionString: "900",
    WFWorkflowIcon: {
      WFWorkflowIconStartColor: 4282601983,
      WFWorkflowIconGlyphNumber: 59511,
    },
    WFWorkflowTypes: [],
    WFWorkflowInputContentItemClasses: [],
    WFWorkflowHasShortcutInputVariables: false,
    WFWorkflowImportQuestions: [
      {
        ActionIndex: 0,
        Category: "Parameter",
        ParameterKey: "WFTextActionText",
        DefaultValue: "",
        Text: "Вставь ключ Word Drill — кнопка «Установить команду» уже скопировала его",
      },
    ],
    WFWorkflowActions: [
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.gettext",
        WFWorkflowActionParameters: { UUID: KEY, WFTextActionText: "" },
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.takescreenshot",
        WFWorkflowActionParameters: { UUID: SCREENSHOT },
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.extracttextfromimage",
        WFWorkflowActionParameters: {
          UUID: TEXT,
          WFImage: variable(SCREENSHOT, "Screenshot"),
        },
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.downloadurl",
        WFWorkflowActionParameters: {
          WFURL: inboxUrl,
          WFHTTPMethod: "POST",
          ShowHeaders: true,
          WFHTTPHeaders: dictionaryField([
            ["Authorization", tokenString("Bearer ￼", KEY, "Text")],
          ]),
          WFHTTPBodyType: "JSON",
          WFJSONValues: dictionaryField([
            ["text", tokenString("￼", TEXT, "Text from Image")],
          ]),
        },
      },
      {
        WFWorkflowActionIdentifier: "is.workflow.actions.notification",
        WFWorkflowActionParameters: {
          WFNotificationActionTitle: "Word Drill",
          WFNotificationActionBody:
            "Текст отправлен во «Входящие» — открой Word Drill → «Слова» → «Входящие»",
          WFNotificationActionSound: false,
        },
      },
    ],
  };
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function toXml(value: Plist, indent: string): string {
  if (typeof value === "string")
    return `${indent}<string>${escapeXml(value)}</string>`;
  if (typeof value === "boolean") return `${indent}<${value}/>`;
  if (typeof value === "number") return `${indent}<integer>${value}</integer>`;
  const inner = `${indent}\t`;
  if (Array.isArray(value)) {
    return value.length === 0
      ? `${indent}<array/>`
      : `${indent}<array>\n${value.map((v) => toXml(v, inner)).join("\n")}\n${indent}</array>`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return `${indent}<dict/>`;
  const body = entries
    .map(([k, v]) => `${inner}<key>${escapeXml(k)}</key>\n${toXml(v, inner)}`)
    .join("\n");
  return `${indent}<dict>\n${body}\n${indent}</dict>`;
}

export function buildShortcutPlist(inboxUrl: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
${toXml(shortcutDefinition(inboxUrl), "")}
</plist>
`;
}
