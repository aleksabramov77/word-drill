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
      <p>Готовая команда ставится одной кнопкой, собирать ничего не нужно.</p>
      <Steps>
        <li>
          Открой{" "}
          <Link to="/more/shortcut" className="underline">
            «Ещё» → «Команда для iPhone»
          </Link>{" "}
          и нажми «Установить команду» — ключ скопируется сам.
        </li>
        <li>Откроются «Команды»: вставь ключ в поле и нажми «Добавить».</li>
        <li>
          Запускай команду «Word Drill» кнопкой действия (iPhone 15 Pro и новее)
          или двойным касанием задней панели (Настройки → Универсальный доступ →
          Касание).
        </li>
      </Steps>
      <p>
        Команда делает снимок экрана, распознаёт на нём текст, отправляет его во
        «Входящие» и показывает уведомление «Текст отправлен».
      </p>

      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer font-medium">
          Если команда не установилась — собрать вручную
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <Steps>
            <li>
              Создай ключ на странице «Команда для iPhone» (если файл не
              открылся, он показан там же).
            </li>
            <li>
              «Команды» → «+». Добавь действия по порядку:{" "}
              <b>Take Screenshot</b>, затем <b>Extract Text from Image</b>.
            </li>
            <li>
              Третьим — <b>Get Contents of URL</b>: адрес{" "}
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
              <code>Bearer &lt;ключ&gt;</code>, тело JSON: поле{" "}
              <code>text</code> = переменная «Текст» из шага 2.
            </li>
          </Steps>
          <Note>
            Порядок важен: распознать текст нужно до отправки. Названия действий
            даны по-английски — в русском интерфейсе ищи их поиском по словам
            «снимок», «текст», «URL».
          </Note>
        </div>
      </details>

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
