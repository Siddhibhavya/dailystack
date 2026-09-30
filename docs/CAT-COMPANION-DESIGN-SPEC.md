# Miku — CatCompanion design specification

This document records the **existing character**, without redesigning it. Miku is the
cat's working name; the application is called **My Life**. The neutral master below
means the original resting pose, including its closed, smiling eyes. It does not mean
a newly drawn open-eyed expression.

## Source of truth

- Working artwork: [CatCompanion.tsx](../src/components/CatCompanion.tsx).
- Palette: [tokens.css](../src/styles/tokens.css).
- Hero outline override and surrounding scene: [app.css](../src/styles/app.css),
  `.cat-scene .cat-companion` and `.scene-*` rules.
- Standalone editable vector: [miku-neutral-master.svg](../src/assets/cat/miku-neutral-master.svg).
- Separately grouped vector: [miku-layered.svg](../src/assets/cat/miku-layered.svg).
- Appearance reference: [phone screenshot](screenshots/phone-portrait.png).

Both standalone SVGs reproduce the original source geometry with explicit **light-mode
hero colors**, transparent backgrounds, and named elements. Neither is wired into the app;
the existing component is unchanged. Expression and movement specifications below are
instructions for future rigs, not additional drawings currently implemented. The app's
`state` attribute currently labels state without changing the SVG's face or pose.

## 1. Character overview

Miku is a front-facing, seated **loaf-shaped** cat. The head is very large and almost
as wide as the body. Two tall, straight-edged ears rise from a broad, gently concave
forehead. The lower head has full curved cheeks and a broad rounded chin. The head
overlaps most of the torso; only a short, wide band of body remains visible below it.
There is no narrow neck, visible hind leg, pronounced muzzle, or realistic anatomy.

The head outline spans native x=52–168 and y=29–125. The body is approximately
125 wide and 54 high before the head covers it. The complete head/body stack spans
y=29–144. Thus, the ears-to-paws height is almost exactly one head width. The broad
head and low body are essential; this is not a long-bodied or upright humanlike cat.

- **Ears:** asymmetric but balanced triangular peaks at (52,29) and (168,29).
  Their outer sides lean slightly inward as they descend. The ear-to-forehead edges
  meet at (85,49) and (136,49); the cheek shoulders are (57,73) and (164,73).
  Each ear contains a thick pink open chevron, not a fully filled pink triangle.
- **Face placement:** slightly left of the head's geometric center. Its axis is x=109;
  the head's bounding-box center is x=110. The eyes sit above two pink oval cheeks.
  The compact nose/mouth is centered low in the face, with room above the eyes.
- **Eyes:** two short, shallow U-shaped curves, with no pupils, eye whites, lashes,
  or brows. Endpoints are y=83 and the visible curve bottoms are y=87. These read as
  contented closed eyes, not tired drooping eyes.
- **Nose:** a tiny, open downward V: (103,98) → (109,102) → (115,98).
  It has no filled triangular patch.
- **Mouth:** a short vertical stem from the nose plus two rounded outward smile
  lobes meeting at (109,108). The lobes dip to about y=112. No filled muzzle,
  teeth, tongue, or cheek outline is present in the master.
- **Blush:** two horizontal solid pink ovals, centered at (75,98) and (143,98).
  They are part of the character's visual signature.
- **Whiskers:** exactly two thin strokes on each side. They project from the cheek
  edges, not from the nose. Upper whiskers tilt upward; lower whiskers tilt downward.
  The left pair is a little longer than the right pair.
- **Paws:** implied by the flat bottom edge and two short vertical division strokes
  at x=84 and x=128. There are no separate oval feet, toes, claws, or paw pads.
- **Tail:** a conspicuously thick dark stroke behind the body on the viewer's right.
  It curls out and upward in an open hook. Its visible tip points down-left toward
  the head, ending at (186,90). Rounded ends keep the hook soft. There is no fur fill
  or thin contour enclosing the tail; the dark stroke is the tail itself.
- **Coat/markings:** flat cream-white head and body. No tabby stripes, forehead M,
  spots, dark ear tips, belly patch, or white muzzle patch. Pink inner ears and blush
  supply color; they are not coat patches.
- **Accessory:** a small, solid strawberry bow under the chin, centered around
  (109,129). It has two angular wings; there is no collar band or outlined knot.

The character communicates quiet contentment, friendliness and a little playfulness.
The heavy curled tail, shy smile, rosy cheeks and tiny bow make it feel inhabited
without needing a dramatic pose. It must never communicate punishment for missed tasks.

## 2. Exact colors

### Character colors

Hex values below are fully opaque. There are no gradients, filters, or semitransparent
shading layers inside the current cat.

| Part | Light hero / standalone master | Other light app placements | Other dark app placements |
| --- | --- | --- | --- |
| Body and head fur | `#FFFDF5` | `#FFFDF5` | `#FFFDF5` |
| Inner-ear markings | `#EFA5AC` | `#EFA5AC` | `#EFA5AC` |
| Blush ovals | `#EFA5AC` | `#EFA5AC` | `#EFA5AC` |
| Outer outline | `#393A33` | `#222321` | `#F9F6ED` |
| Eyes | `#393A33` | `#222321` | `#F9F6ED` |
| Nose and mouth | `#393A33` | `#222321` | `#F9F6ED` |
| Whiskers and paw lines | `#393A33` | `#222321` | `#F9F6ED` |
| Tail, including its solid dark interior | `#393A33` | `#222321` | `#F9F6ED` |
| Bow | `#DD5359` | `#DD5359` | `#F0888E` |
| Fur shadows / highlights | None | None | None |
| Eye whites / pupil fill | None: closed stroked eyes | None | None |

**CSS resolution matters:** `.cat-companion` inherits the app ink color, but the hero
scene explicitly sets it to `#393A33`. That hero override also applies in dark mode;
its bow becomes `#F0888E` while the fur and pink markings remain unchanged. For reuse
outside the app, choose the standalone master palette; do not mix placement variants
or interpret the inherited colors as additional coat markings.

### Surrounding scene and app colors — not part of the cat

| Role | Light value | Dark value if overridden |
| --- | --- | --- |
| Warm off-white app canvas | `#FAF8F2` | `#222326` |
| White cards/surface | `#FFFFFF` | `#2D2E31` |
| Primary typography | `#222321` | `#F9F6ED` |
| Secondary typography | `#74736D` | `#C6C1B6` |
| Borders | `#ECE9E1` | `#414145` |
| Sunny hero / selected date / Log button / flower center | `#FFCC49` | `#F1BD41` |
| Soft yellow accent | `#FFF2C9` | `#4A4028` |
| Strawberry accent / flower petals | `#DD5359` | `#F0888E` |
| Blush Quick Log card | `#F9E4E5` | Same explicit value |
| Periwinkle supporting accent | `#BCB5E4` | `#C6BFEA` |
| Green supporting accent | `#506652` | `#E8C571` |
| Ground ellipse beneath the cat | `#EABA41` | Same explicit value |
| Sun ring and dashed halo | `#BD8735` | Same explicit value |
| Flat cloud shapes | `#FFE9A4` | Same explicit value |
| Small scene sparkles | `#A96536` | Same explicit value |
| Flower stem/leaves | `#63744F` | Same explicit value |
| Hero copy | `#282820` | Same explicit value |
| Small hero label | `#61532A` | Same explicit value |

The ground ellipse is a **scene element**, not a shaded patch on the cat. Clouds,
sun, sparkles, flower, card geometry and app controls should not be baked into a
character-only asset. A transparent master keeps Miku reusable on other backgrounds.

## 3. Shape construction and normalized proportions

### Coordinate convention

Native SVG viewBox: `0 0 220 170`; y increases downward. Left/right in this document
mean **viewer-left / viewer-right**, not the cat's anatomical sides.

Treat the head's **unstroked outer width of 116 native units as 100 design units**.
Do not measure from whisker tips or the tail. Use the left ear apex as normalized
(0,0), corresponding to native (52,29):

```text
normalized x = (native x − 52) × 100 / 116
normalized y = (native y − 29) × 100 / 116
native x = 52 + normalized x × 1.16
native y = 29 + normalized y × 1.16
```

The coordinates below describe geometric paths before stroke expansion. The original
SVG is authoritative for exact curves; rounded proportions are reconstruction aids.

| Feature | Native geometry | Relative to head width = 100 |
| --- | --- | --- |
| Head, including ears | 116 wide × 96 high | 100 wide × 82.76 high |
| Total head/body stack | y=29–144 | 99.14 high |
| Body before occlusion | about x=45.00–169.94, y=90–144 | 107.70 wide × 46.55 high |
| Exposed lower body below chin | y=125–144 | 16.38 high |
| Flat body base | x=63–146 at y=144 | 71.55 wide |
| SVG canvas, including transparent margins | 220 × 170 | 189.66 × 146.55 |
| Face axis | x=109 | x=49.14 |
| Eye baseline endpoints | y=83 | y=46.55 |
| Left eye center of visible curve | (85,87) | (28.45,50.00) |
| Right eye center of visible curve | (134,87) | (70.69,50.00) |
| Eye center separation | 49 | 42.24 |
| Each closed eye | 14 wide, 4 actual curve depth | 12.07 wide, 3.45 deep |
| Nose | 12 wide × 4 high | 10.34 wide × 3.45 high |
| Nose bottom | (109,102) | (49.14,62.93) |
| Mouth junction | (109,108) | (49.14,68.10) |
| Mouth lobes together | 28 wide, 4 curve depth | 24.14 wide, 3.45 deep |
| Blush oval | rx=8, ry=5 | 13.79 wide × 8.62 high |
| Left blush center | (75,98) | (19.83,59.48) |
| Right blush center | (143,98) | (78.45,59.48) |
| Paw division spacing | 44 | 37.93 |
| Each paw division length | 12 | 10.34 |
| Bow bounds | x=99–119, y=124–134 | 17.24 wide × 8.62 high |
| Tail thickness | 10 | 8.62 |

### Head and ears

Start with a broad cheek/chin curve, then join two tall triangular ears to its top.
The ears are integrated into the head contour, not separate triangles glued on top.
The forehead between the ear roots is a shallow concave cubic curve. Ear apex spacing
is exactly one head width. Relative landmarks:

| Landmark | Normalized (x,y) |
| --- | --- |
| Left ear apex | (0,0) |
| Left forehead root | (28.45,17.24) |
| Left cheek shoulder | (4.31,37.93) |
| Right ear apex | (100,0) |
| Right forehead root | (72.41,17.24) |
| Right cheek shoulder | (96.55,37.93) |
| Chin center endpoint | (49.14,82.76) |

Use the exact head contour for faithful reproduction:

```svg
M57 73 L52 29 L85 49
C100 42 120 42 136 49
L168 29 L164 73
C174 113 144 125 109 125
C74 125 46 108 57 73 Z
```

Inner-ear pink paths are `(62,45) → (65,63) → (78,55)` on the left and
`(150,55) → (160,45) → (158,64)` on the right. These are stroked open chevrons.
Preserve their small asymmetry.

### Body and paws

The body is a closed, wide flattened blob:

```svg
M56 96 C39 114 42 142 63 144
L146 144 C176 139 176 103 156 90 Z
```

Its diagonal closing edge is hidden by the head. Its bottom is horizontal. Draw the
body behind the head. Add two round-ended vertical strokes from (84,132) to (84,144)
and (128,132) to (128,144). These suggest tucked forepaws; do not add outlined feet.

### Face

Use shallow quadratic curves for the eyes and mouth. Each eye has a control point
8 native units below its endpoint baseline, giving an actual curve depth of 4 units:

```svg
left eye:  M78 83 Q85 91 92 83
right eye: M127 83 Q134 91 141 83
nose:      M103 98 L109 102 L115 98
mouth:     M109 102 V109
           M109 108 Q100 116 95 108
           M109 108 Q118 116 123 108
```

Whiskers: `(60,95) → (38,91)`, `(60,101) → (37,105)`,
`(161,95) → (181,91)`, `(161,101) → (181,105)`.

### Tail and bow

The tail is **one open cubic centerline with a thick round-ended stroke**:

```svg
M163 126 C210 138 203 75 186 90
```

Its centerline reaches approximately x=198.89; control points are not visible outline
extrema. At head width 100, the tail root is (95.69,83.62) and its tip is
(115.52,52.59). Keep it behind the body, so its root disappears naturally.

The bow is a flat polygon, without stroke:

```svg
M99 124 L109 128 L119 124 L117 134 L109 130 L101 134 Z
```

Do not turn it into a large ribbon, a necktie, a collar bell or a differently shaped
accessory in the default character.

## 4. Line / stroke style

| Line | Native width | At head width 100 | Treatment |
| --- | --- | --- | --- |
| Head outer contour | 3 | 2.59 | Round joins; closed path |
| Body contour | 3 | 2.59 | Original SVG default miter joins; mostly smooth curves |
| Paw division strokes | 3 | 2.59 | Round caps |
| Eyes, nose, mouth, whiskers | 2.5 | 2.16 | Round caps; original default joins |
| Inner-ear accents | 4 | 3.45 | Pink; round caps; original default joins |
| Tail | 10 | 8.62 | Dark solid stroke with round caps |

The outline is **not uniformly thick across all parts**. Facial strokes are slightly
lighter; the tail is deliberately much heavier. Blush and bow have no outlines. The
head's corners are geometrically angular but softened by round stroke joins.
Use flat, clean vector strokes; do not add rough pencil textures, sketch duplicates,
heavy variable-width calligraphy or gradients. The charm comes from the asymmetric
geometry, not a distressed line texture. Scale strokes with the artwork; do not use
non-scaling strokes when resizing the entire character.

## 5. Reusable facial system

All future expressions retain eye centers around native (85,87) and (134,87), the
nose anchor at (109,102), and mouth junction at (109,108). Keep the 49-unit eye spacing,
blush centers, whisker roots and ear proportions. Expression changes must not widen
the muzzle, shift the eyes toward the forehead, or introduce realistic feline eyes.

The only existing face is the closed-smile master. The following expression variants
are **proposed rig instructions**, not replacements for that master. Any open-eye
variant should use simple small dark shapes, not large glossy eyes or eye whites.

| Expression | Eyes and mouth | Ears / posture |
| --- | --- | --- |
| Neutral / resting | Exact master: shallow U-shaped closed eyes, V nose, twin smile lobes | Exact loaf pose and hooked tail |
| Happy | Master eye shapes; at most 1–2 units more curve depth; same small smile | Head up slightly, bow stays small |
| Sleepy | Closed curves slightly flatter; mouth relaxed but still kind | Head sinks 2–3 units; ears remain upright, not drooping dramatically |
| Listening | Optional small dark vertical eye ovals, about 4 wide × 6 high, centered on existing eye anchors; mouth unchanged | Head tilt 3–5°; subtle ear reaction |
| Curious | Same small open eyes; one eye may be 1 unit taller; tiny mouth opening centered below the nose | Head tilt, one ear rotates slightly; no permanent brows |
| Concerned / gentle | Half-closed curves or a slow blink; smaller soft smile | Slight forward head inclination; never a distressed or guilty face |
| Excited | Cheerful closed curves or slightly taller small open eyes; small rounded open mouth, at most 6 wide × 5 high | Small lift, attentive ears; no exaggerated screaming mouth |
| Focused | Small open eyes narrowed vertically, still at the same anchors; mouth lobes slightly flatter | Head lowered a little toward a prop; paws remain compact |
| Eating | Closed relaxed eyes; a small mouth open/close movement of 1–3 units | Brief head dip toward food; no stretched muzzle |
| Drinking | Closed or half-closed eyes; tiny mouth motion directed toward bowl edge | Small forward nod; tongue, if necessary, is a temporary prop/action detail |

For new open-eye faces, blink by scaling each eye vertically around its center before
switching to the master closed curve. The two eyes move together with a small timing
offset if desired. Do not squash the entire face to simulate a blink. Proposed open
eyes use the same outline/face color; no new permanent colors or markings are needed.

## 6. Animation-ready layer model

### What the separately grouped vector actually contains

The hierarchy below is in `miku-layered.svg`. The neutral master keeps the original
combined path commands intact for exact render fidelity; its main named primitives
are tail, body, head contour, ear markings, blush, face, paw divisions and bow.

```text
cat
├── cat-tail
├── cat-back-body
│   └── cat-body
├── cat-head
│   ├── cat-head-contour  [outer ears are integrated here]
│   ├── cat-ear-left      [existing pink inner-ear stroke]
│   ├── cat-ear-right     [existing pink inner-ear stroke]
│   └── cat-face
│       ├── cat-blush-left
│       ├── cat-blush-right
│       ├── cat-eye-left
│       ├── cat-eye-right
│       ├── cat-nose
│       ├── cat-mouth
│       ├── cat-whiskers-left
│       └── cat-whiskers-right
├── cat-paw-left          [existing division stroke only]
├── cat-paw-right         [existing division stroke only]
├── cat-accessory-bow
└── cat-optional-prop     [empty insertion slot]
```

This draw order reproduces the app, including the tail hidden behind the body and
the bow painted last. **The ears and forepaws are not already fully independent filled
limbs.** Group labels do not create missing geometry. For ear twitches, use vertex
deformation of the head contour together with its inner-ear group, or create a rig-only
split contour that matches the master exactly at rest. Do not draw duplicate seams
at ear roots. For reaching paws, create rig-only occluded arm/paw shapes and hide them
behind the existing body at rest. The neutral export intentionally invents none.

### Pivots and anchors

Native pivots are also stored as `data-pivot` attributes in the layered SVG. These attributes
are documentation, not executable animation transforms. Set actual anchors in the
animation software; do not rely on its default bounding-box center.

| Motion | Native pivot / anchor | Normalized pivot | Rig guidance |
| --- | --- | --- | --- |
| Head tilt | (109,121) | (49.14,79.31) | Near chin/neck overlap; tilt the entire head and its face together |
| Left ear twitch | (68,62) | (13.79,28.45) | Deform outer-ear vertices around root; move pink inset with them |
| Right ear twitch | (154,62) | (87.93,28.45) | Same, mirrored; avoid moving the whole cheek |
| Left blink | (85,87) | (28.45,50.00) | Eye-local anchor |
| Right blink | (134,87) | (70.69,50.00) | Eye-local anchor |
| Left paw movement | (84,132) | (27.59,88.79) | Current stroke anchor; reaching motion needs a derived limb |
| Right paw movement | (128,132) | (65.52,88.79) | Same limitation |
| Tail movement | (163,126) | (95.69,83.62) | Root stays behind body; curve-deform distal tail rather than swinging a rigid hook |
| Breathing / body | (109,144) | (49.14,99.14) | Keep base planted; scale mostly vertically, about 1–2% |
| Whole-body bounce | (109,144) | (49.14,99.14) | Move cat root; keep proportions intact |
| Bow | (109,128) | (49.14,85.34) | Small secondary motion below chin; no large flapping |

For head tilt, animate head, face and ears as one parent; give the bow only a small
following movement so it remains at the neckline. Body breathing should not stretch
the face, and the head should not detach from the short torso.

## 7. Core animation states

These are small future loops, not implemented app behavior. Amplitudes below are
normalized units at head width 100. Use gentle easing, short settling pauses, and
slight timing variation. Avoid perfectly synchronized mechanical repetition. Keep
the tail's recognizable hook and the planted loaf silhouette through most of each loop.

| State | Loop suggestion |
| --- | --- |
| IDLE | 4–6-second breath, 1–2% vertical body expansion; head rises less than 1 unit; tail tip drifts 1–2 units. If using open eyes, occasional 120–200 ms blink about every 5–9 seconds. The exact closed-eye master simply breathes without blinking open. |
| SLEEPING | 6–8-second breath, eyes closed throughout; head settles 1–2 units. Rare single ear-tip twitch of 1–2 units every 10–18 seconds; no startled jerks. |
| LISTENING | 4–7 seconds: head tilts 3–5°, holds, returns slowly. One ear reacts before the other by 100–180 ms; optional small open eyes. |
| WORKING | 3–5 seconds: lowered focused head and 1–2-unit paw/prop action, then a pause. Keep most of the body still; use a rig-derived paw only when needed. |
| EATING | 3–4 seconds: two small 1–2-unit head dips toward an optional bowl, tiny mouth motion, then a quiet pause. No rapid chewing vibration. |
| DRINKING | 3–5 seconds: forward head tilt of 2–4°, two or three tiny mouth/nod motions, then a pause. Bowl remains an independent prop. |
| OUTSIDE | 5–8 seconds: alert ears, a 3–5° curious head turn/tilt, small tail-tip motion, return to rest. Do not make the cat pace continuously. |
| GENTLE | 6–9 seconds: slow 300–500 ms blink if eyes are open, relaxed head dip under 2 units, very quiet breathing. No sadness, sickness or guilt signals. |
| CELEBRATING | One or two small 2–4-unit bounces over 2–3 seconds with a soft tail follow-through; settle into a longer resting hold. Do not run an endless jumping loop. |

Use a maximum of a few degrees for ear/tail root rotation and only minor squash/stretch
(around 1–3%). Animation should feel soft, slightly imperfect and charming rather than
hyperactive. Props do not become permanent parts of the character. For reduced-motion
contexts, show the unchanged master or a still expression with no looping motion.

## 8. SVG / vector source and reuse

The neutral master is a standalone SVG with explicit colors, editable paths/ellipses,
meaningful element IDs, and a transparent 220×170 viewBox. The separately grouped
`miku-layered.svg` provides the detailed hierarchy above. There are no fonts, external
references, CSS variables, embedded rasters, masks, gradients or application dependencies.
It can be imported as vector artwork into Figma or another SVG-capable design tool.
Importers vary in how they preserve SVG group names; check the resulting layer names.

The original component combines many face subpaths in one path. The neutral master
retains those exact commands. The layered export separates them into named groups
without changing geometry or palette. Ear insets are likewise separated using equivalent
absolute coordinates. Separate path elements can produce tiny antialiasing differences
where strokes meet, so the neutral master is the render reference. The head silhouette
remains a single authoritative contour in both files.

For a rigged derivative, duplicate the master, preserve an untouched reference, and
compare the derivative's neutral frame over the original at 100% scale. Keep a flat
export without props as the neutral reference. Do not flatten the source into a bitmap.
Do not silently replace the application component with a rigged derivative.

## 9. Character consistency rules

### Must not change in the canonical character

- Broad 100-unit head, approximately 83-unit head height including ears, and
  approximately 99-unit total head/body height in the original loaf pose.
- Slightly asymmetric triangular ear geometry and the shallow concave forehead.
- Face axis around x=49.14 normalized; 42.24-unit eye-center spacing; low compact muzzle.
- Cream-white uninterrupted coat; no invented tabby marks, forehead spot or belly patch.
- Pink open inner-ear chevrons and paired horizontal blush ovals.
- Small V nose and two rounded smile lobes; no large muzzle, human lips or realistic nose.
- Two whiskers per cheek, with their roots at the outside cheek edges.
- Short body, flat paw base, and restrained paw divisions in the resting pose.
- Thick, round-ended dark hook tail on viewer-right in the canonical front view.
- Small strawberry angular bow under the chin in the default design.
- Clean flat line treatment: 3-unit contours, 2.5-unit face, 4-unit ear accents,
  10-unit tail at native scale. No gradients or painted fur texture.
- Contented, gentle personality. Never express disappointment because someone missed a task.

### May change while preserving identity

- Eye openness, restrained mouth expression and the proposed small facial movements.
- Head tilt, body pose, direction of gaze and carefully derived limb positions.
- Optional props such as a bowl, journal or skates; props must not hide all identity anchors.
- Orientation. A deliberate mirrored view may put the tail on viewer-left; it should
  mirror the complete character rather than arbitrarily moving only the tail.
- Small timing differences, ear twitches, breathing and secondary bow motion.
- Composition, background and scale, provided character geometry and strokes scale together.
- Accessory occlusion when a pose requires it. Keep the default bow when visible; changing
  accessories is an intentional variant, not a new default character.

For full-body poses, the original SVG does not define hidden anatomy. Keep derived
limbs short and simple, preserve head/face/tail signatures, and return to the exact
original silhouette in the neutral rest pose. Do not reinterpret Miku as a different
breed, a realistic cat, a glossy 3D mascot or a generic emoji.

## 10. MASTER MIKU CHARACTER PROMPT

Use the supplied neutral SVG as the visual identity reference whenever the generation
tool accepts one. Text alone cannot guarantee an exact match; compare the result's
geometry and palette against the master before reusing it.

> Draw Miku, the specific cream-white loaf cat from the supplied My Life neutral master.
> Preserve the original flat vector identity: a very large broad head with two tall,
> straight-edged triangular ears integrated into its contour, a shallow concave forehead,
> rounded full cheeks and a broad soft chin above a very short, wide tucked body with a
> flat base. In the front-facing resting pose, head width is 100 units, head height including
> ears is about 83 units, full ears-to-paws height is about 99 units, and the body is about
> 108 units wide with only a 16-unit band visible beneath the chin. Use flat cream-white
> #FFFDF5 for head and body, with no coat stripes, forehead marks, patches or fur shading.
> Use clean dark olive-charcoal #393A33 contours approximately 2.6 units thick, softened
> ear joins, and slightly thinner 2.2-unit round-ended facial strokes. Each inner ear has
> an open pink #EFA5AC chevron with a 3.45-unit stroke. Keep the small asymmetry of the
> ears. Place the face just left of center, with eye centers about 42 units apart, each
> closed eye a short shallow U-shaped smile curve about 12 units wide and 3.45 units deep.
> Keep the tiny open downward-V nose centered low on the face, only about 10 units wide,
> and the short vertical mouth stem ending in two small rounded outward smile lobes.
> Add two solid horizontal pink #EFA5AC blush ovals, about 14 units wide by 9 units high,
> outside and below the eyes. Draw exactly two thin whiskers projecting from each cheek
> edge, the upper ones angled upward and the lower ones angled downward. Indicate tucked
> front paws with only two short rounded vertical division lines, about 38 units apart;
> do not add claws or detailed toes in the loaf pose. Behind the viewer-right body draw
> the signature thick solid charcoal hook tail, approximately 8.6 units thick, curling
> outward and upward before its rounded tip turns down-left toward the head. Keep the
> tail dark throughout, not a cream tail with an outline. Under the chin place the tiny
> flat strawberry-red #DD5359 angular bow, about 17 units wide by 9 units high, without
> a collar band, bell or oversized ribbon. The character is quietly contented, warm,
> slightly playful and never frantic, guilty or distressed. Preserve the same face
> spacing, ear shape, blush, small muzzle, short proportions, heavy hook tail and bow
> in every pose. Use flat opaque colors, editable-looking clean vector shapes, no
> gradients, no glossy eyes, no 3D rendering, no emoji styling and no added fur texture.
> Keep the character separate from any background; a transparent background is the
> default. Any requested prop is temporary and must not replace the character's identity.
>
> **[POSE / ACTION / EXPRESSION]**

Replace the final placeholder with, for example, `[MIKU DRINKING WATER]`,
`[MIKU SLEEPING]`, `[MIKU HOLDING A JOURNAL]`, `[MIKU SKATING]`, or
`[MIKU PEEKING FROM BEHIND A CARD]`. Keep the identity instructions intact.
