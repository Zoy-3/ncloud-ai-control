# Flatsome schema capture plan

A future `flatsome-schema.json` will describe the exact shortcode syntax supported by the
installed Flatsome UX Builder version. This file deliberately does not exist yet because
guessing a production schema would be unsafe.

The schema will be built by manually creating one example of every supported element:

- Section
- Row
- Column
- Text
- Image
- Image Box
- Button
- Icon Box
- Banner
- Accordion
- Tabs
- Slider
- Gallery

For each element, use the installed UX Builder as the source of truth:

```text
Create element
  ↓
Save page
  ↓
Open normal WordPress editor
  ↓
Read generated shortcode
  ↓
Record exact syntax
  ↓
Add to Flatsome schema
```

Production AI generation must follow that verified schema. The empty `[ux_image]` used in
the phase-one mock samples is only a structural placeholder; it is not a declaration that
this shortcode is valid for the installed production version.
