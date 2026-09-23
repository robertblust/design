# The refusal names the moment

Status: proposed. Decided on 2026-09-23 with the owner, who ran into the chat's limit on blust.ch, against this repository at v0.80.2 and `companygraph/chat-server` at v0.7.0, whose files were read that day. The server's half is the chat server's spec of the same name, in that repository; this is the widget's half, and it is built once that release exists, on this branch, and reaches the two sites that run the chat by re-pin.

## Why now

The chat's bucket allows twenty messages an hour per address in a sliding window, so a refused visitor waits until the oldest of their last twenty is an hour old: seconds, or the whole hour. The widget's sentence for that refusal says "try again in a minute". It was written for the model's minute, the other case the same code covers, and for the bucket it is wrong; a visitor who obeys it is refused again. The server knows the moment and will send it: `error.retryAt`, an ISO time in UTC, on `busy`, `over_day` and `over_month`, and no field on any other code.

## The shape

**The widget keeps the moment.** Where it reads a refused response, it keeps `retryAt` beside the code instead of reducing the body to the code, and `refuse` takes both. A code without a moment, and a response whose body could not be read, refuse as today.

**The sentence ends with the moment, in the visitor's terms.** For the three codes the refusal sentence gains one clause, written from the moment and the visitor's clock, in the page's language and the browser's time zone. Within the hour, in minutes: "You can ask again in 12 minutes." Later the same local day, at a time: "You can ask again at 14:35." On another local day, the day and the time: "You can ask again tomorrow at 02:00", which is what midnight UTC looks like in Zürich, and "on Thursday at 02:00" beyond tomorrow, since the month's ceiling lifts on the first. Under a minute, "in a minute", the one case where the old sentence was right. The German is drafted for the Translator beside the English, as every string of the widget is. The clause says "at" and never "exactly at": the bucket is per instance, and a visitor may find the chat open earlier than the moment says and never later.

**Where the field is absent the sentences stand**, except that `busy` stops promising a minute: "Too many messages for the moment; try again later." A widget that meets a server without the field degrades to that, and a server that meets a widget without the reading is ignored, so the two releases need no order.

**The formatting is a pure part.** `rbChat.when(retryAt, now, lang)` returns the clause, or an empty string for an unreadable moment or one in the past, and hangs on `rbChat` beside `md` and `readEvents` so the suite holds it in Node with a fixed clock and a fixed zone. It uses the browser's `Intl.DateTimeFormat` for the time and the day name, in the page's language, and counts minutes itself.

## What has to change with it

`assets/chat.js`: the refusal read, `refuse`, the strings, and `when`. `test/chat.test.mjs`: the clause for each of the four distances on a fixed clock, in both languages; the past and the unreadable returning empty; a refusal without the field giving the plain sentence; and the existing test that every code has a sentence in both languages, unchanged. The README's chat paragraph gains one sentence saying the widget names when a limit lifts where the server says.

## What this is not

Not a retry the widget makes on its own: the visitor decides when to ask again. Not a countdown: the clause is written once, when the refusal arrives. Not a change to the sentences for the codes that have no moment.

## The order

After the chat server's release that carries the field, so the suite's fixture can be a real refusal. One release of this package, the next minor after whatever `main` carries, and one re-pin on blust.ch and on companygraph.io; guestgraph.io runs no chat and takes nothing. Merging, the tag and the re-pins each wait for the owner's word.
