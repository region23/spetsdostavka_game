# Промпты ассетов

Все растровые исходники созданы встроенным инструментом `image_gen`, без API/CLI fallback. Генерация выполнена 5 сентября 2026 года. Текст интерфейса и бирки набираются отдельно.

## 1

Use case: stylized-concept. Asset type: background-only game environment, wide landscape 1536x864. A beautifully art-directed sunlit main post office in an optimistic alternate Soviet modernist future, monumental pale limestone arches, enormous glass windows with slender bronze mullions, distant white terraced towers and gardens and an elevated monorail visible outside, sage green wall panels, restrained deep terracotta architectural accents, warm cream travertine, brass fixtures. Strict orthographic side elevation camera for a 2D platformer, NOT isometric. Rich atmospheric hand-painted 3D illustration, refined cinematic sunlight, tactile paper and stone, warm inviting lived-in utopia, not dystopia. Main architectural window gallery spans the width from x=0 to x=1536. Lower 25 percent quiet pale stone rear wall with subtle horizontal joints, NO foreground floor, NO playable platforms, no objects crossing foreground. Upper quarter restrained architectural detail. Environment backdrop ONLY. No people, no courier, no luggage, no machines, no UI, no lettering, no signage, no watermark. Crisp shapes and muted distant contrast so dark navy game character and terracotta mechanisms remain legible.

## 2

Use case: stylized-concept. Asset type: production 2D side-view character sprite atlas on actual transparent background. ONE consistent adult male postal courier in graphite navy blue worker uniform, short navy jacket, matching trousers, navy peaked work cap, sturdy dark brown boots, warm human face, middle aged. Side profile facing right, no bag or parcel: these are attached separately by the game. Hand-painted detailed cutout style, warm natural light, elegant human realistic anatomy, clean silhouette. EXACT uniform grid 4 columns by 2 rows, 1024x1024 square, each cell 256 wide x512 high. Every figure fits inside its own cell with clear empty padding, equal 380-pixel standing height, feet baseline at 460 within each cell, centered x128. Eight poses in reading order: row1 idle standing; running contact with left leg forward; running passing feet beneath body; running contact right leg forward. Row2 airborne jumping with bent legs; falling reaching forward; hanging from a ledge with arms raised overhead (ledge not drawn); standing leaning forward reaching hands to handle a parcel (parcel not drawn). No text, no frame borders, no shadows outside silhouette, no objects, no duplicate figures within a cell. Keep character's face, cap, uniform design and scale consistent across all 8 frames. Actual transparent alpha, not a checkerboard drawing.

## 3

Use case: product-mockup. Asset type: isolated menu hero illustration for a retrofuturist postal platform game. A beautifully designed vintage-futurist postal courier's satchel, navy graphite woven canvas with dark brown leather straps, warm worn edges, two brass buckles, sturdy boxy silhouette, short leather handle and shoulder strap looping elegantly above, a small terracotta service seal bearing only a simple PAUSE symbol (two vertical bars), attached blank cream paper dispatch tag. Three quarter view, entire bag visible, centered with 15 percent padding. High-end painterly 3D concept illustration, soft warm studio lighting, tactile material detail. Plain perfectly uniform warm cream background #eee8d8, no floor horizon, no additional objects, no cast shadow outside bag. NO words, NO letters, NO watermark, NO checkerboard. Square format.

## 4

Use case: stylized-concept. Asset type: background-only game environment, wide 16:9. Orthographic side elevation of a sunny Soviet modernist futuristic post office service lift hall, quiet sage green enamel wall panels with subtle seams, cream stone walls and bronze tall vertical lift rails, glazed clerestory across upper edge showing blue sky. Monumental functionalist forms, a large circular architectural ventilation opening in upper right, warm terracotta trim, soft diagonal daylight. Beautiful refined hand-painted 3D illustration, optimistic functioning utopia. No moving equipment or lift platforms, no floors in front, no machinery in foreground, no people, no letters, no signage, no text or UI. Rear background ONLY, low visual contrast, lower half quiet flat sage panels, no prominent pillars blocking foreground. Wide stage for a 2D puzzle platform game.

## 5

Use case: stylized-concept. Asset type: background-only environment for final room of 2D platform game, 16:9 landscape. Strict side elevation of a warm Soviet modernist small community music hall inside a futuristic grand post office. Cream limestone, restrained sage green and terracotta panels, a huge rounded window with bronze frames onto a sunny garden in the left half. In the RIGHT HALF, a glass interior partition reveals an intimate raised rehearsal room, a beautiful small dark upright piano and five friendly understated human silhouettes gathering for their first concert, one seated at the piano, warmly glowing lamps. Muted gentle afternoon light, warm ochre accents, subtle plants. Rich hand-painted 3D illustration, quiet hopeful humane atmosphere. The rehearsal area is clearly behind glass and in background, with wide clear lower 25 percent pale wall for separate game foreground geometry. No courier, no parcel, no readable text, no UI, no foreground platforms.

## 6

Use case: background-extraction. Edit target: this exact courier sprite sheet. Change ONLY the checkerboard background to a genuinely transparent background with alpha. Keep all eight courier figures, their exact pixel placement, size, clothing, colors, poses and outlines unchanged. Do not redraw the characters. Do not draw any white or gray checkerboard. If actual alpha is unavailable, use a perfectly solid pure white #ffffff background, no pattern, no shadows. Preserve exact dimensions and sprite layout.


## Обновление иллюстраций и параллакса

Сюжетные иллюстрации для трёх карточек и отдельный дальний город: [полные промпты](visual-refresh-prompts.md). Все четыре изображения созданы встроенным `image_gen`.

Попытка исправить атлас генератором убрала фрагмент руки, но изменила размер и потеряла альфа-канал. Она не используется в игре. Итоговый `courier-clean.png` подготовлен из прежнего RGBA-атласа скриптом `scripts/prepare-courier.mjs`: сохраняется связный силуэт каждого кадра, удаляется попавшая в кадр падения рука соседнего персонажа. Семь остальных кадров, размеры и привязка ступней сохранены без изменений.
