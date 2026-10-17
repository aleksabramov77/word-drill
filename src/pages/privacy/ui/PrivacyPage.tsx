/** Политика конфиденциальности — открыта всем (её требует Google для входа через Google). */
export function PrivacyPage() {
  return (
    <article className="flex flex-col gap-4 text-sm leading-relaxed">
      <h1 className="font-semibold text-2xl">Конфиденциальность</h1>
      <p>
        Word Drill — личный тренажёр английских слов для небольшого круга людей.
        Пользоваться им можно только с разрешения владельца.
      </p>
      <h2 className="font-medium text-base">Что мы храним</h2>
      <ul className="list-disc pl-5">
        <li>
          Из аккаунта Google — только почту и имя: по ним вы входите и по ним
          владелец решает, пускать ли вас.
        </li>
        <li>
          Ваши слова, ответы на них и настройки уведомлений — чтобы приложение
          подбирало, что и когда повторять.
        </li>
        <li>
          Подписку на уведомления вашего устройства — чтобы присылать слова.
        </li>
      </ul>
      <h2 className="font-medium text-base">Чего мы не делаем</h2>
      <ul className="list-disc pl-5">
        <li>Не передаём и не продаём данные никому.</li>
        <li>Не показываем рекламу и не используем данные для неё.</li>
        <li>Не получаем доступа к почте, файлам и другим данным Google.</li>
      </ul>
      <h2 className="font-medium text-base">Удаление</h2>
      <p>
        Слова удаляются кнопкой в списке слов. Чтобы удалить аккаунт целиком,
        напишите владельцу: aleksabramov77@gmail.com.
      </p>
      <a href="/" className="underline">
        На главную
      </a>
    </article>
  );
}
