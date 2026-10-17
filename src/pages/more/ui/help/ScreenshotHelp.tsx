import { Copy } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Article, Bullets, H2, Note, Steps } from "./parts.tsx";

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Скопировано"),
    () => toast.error("Не получилось скопировать — выдели и скопируй вручную"),
  );
}

export function ScreenshotHelp() {
  const inboxUrl = `${window.location.origin}/api/inbox`;
  return (
    <Article>
      <p>
        Увидел трудное слово в Duolingo — отправь текст с экрана в Word Drill.
        Он попадёт во «Входящие» (вкладка на странице «Слова»), а там приложение
        само найдёт слова курса и предложит добавить их одним нажатием.
        Распознавание текста встроено в телефон и бесплатно.
      </p>

      <H2>iPhone: команда «скриншот → Word Drill»</H2>
      <p>
        Один раз собираешь команду в приложении «Команды», дальше — одно
        нажатие.
      </p>
      <Steps>
        <li>
          Создай ключ:{" "}
          <Link to="/more/shortcut" className="underline">
            «Ещё» → «Ключ для «Команд»»
          </Link>
          .
        </li>
        <li>
          «Команды» → «+» (новая команда). Добавь действие{" "}
          <b>Take Screenshot</b>.
        </li>
        <li>
          Действие <b>Extract Text from Image</b> — из скриншота.
        </li>
        <li>
          Действие <b>Get Contents of URL</b>: адрес{" "}
          <code className="break-all">{inboxUrl}</code>{" "}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1"
            aria-label="Скопировать адрес"
            onClick={() => copy(inboxUrl)}
          >
            <Copy />
          </Button>
          , метод POST, заголовок <code>Authorization</code> ={" "}
          <code>Bearer &lt;ключ&gt;</code>, тело — JSON с полем{" "}
          <code>text</code> = текст из шага 3.
        </li>
        <li>
          Запускай кнопкой действия (iPhone 15 Pro и новее) или двойным касанием
          задней панели (Настройки → Универсальный доступ → Касание).
        </li>
      </Steps>
      <Note>
        Названия действий даны по-английски: русские названия в «Командах» не
        сверены — в русском интерфейсе ищи действие поиском по словам «снимок»,
        «текст», «URL». Для выделенного текста подойдёт та же команда без шагов
        2–3, с включённым «Показывать в меню „Поделиться“».
      </Note>

      <H2>Android: «Поделиться» → Word Drill</H2>
      <p>
        На Android команда не нужна: установленный Word Drill сам появляется в
        меню «Поделиться».
      </p>
      <Steps>
        <li>Установи Word Drill на экран (см. «Установить как приложение»).</li>
        <li>
          Выдели текст в любом приложении — или на скриншоте через Google
          Объектив (Lens): он умеет выделять текст на картинке.
        </li>
        <li>Нажми «Поделиться» и выбери Word Drill.</li>
        <li>Откроются «Входящие» с найденными словами.</li>
      </Steps>
      <Note>
        Названия пунктов на разных Android-телефонах немного отличаются.
      </Note>

      <H2>Без всего этого</H2>
      <Bullets>
        <li>
          Скопируй текст и вставь его во «Входящие» на странице «Слова» → кнопка
          «Разобрать».
        </li>
        <li>Или добавь слово вручную: вкладка «Вручную».</li>
      </Bullets>
    </Article>
  );
}
