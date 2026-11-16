// src/web/menu.css
var menu_default = '.pm {\n  --menu-ink: var(--foreground, #251f19);\n  --menu-muted: var(--muted-foreground, #655d54);\n  --menu-line: var(--border, #dcd2c4);\n  --menu-paper: var(--card, #faf6ef);\n  --menu-accent: var(--primary, #8b3a2a);\n  color: var(--menu-ink);\n  border-top: 1px solid var(--menu-line);\n  padding-top: 28px;\n  display: grid;\n  gap: 18px;\n  overflow-wrap: anywhere;\n}\n.pm *,\n.pm *::before {\n  box-sizing: border-box;\n}\n.pm h2,\n.pm h3,\n.pm p,\n.pm ul {\n  margin: 0;\n}\n.pm header,\n.pm .row,\n.pm .actions,\n.pm .menu-tabs,\n.pm .confirm {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n}\n.pm header {\n  justify-content: space-between;\n}\n.pm h2 {\n  font-size: 1.25rem;\n  font-weight: 650;\n}\n.pm button {\n  min-height: 44px;\n  padding: 8px 12px;\n  border: 0;\n  border-radius: 9px;\n  background: transparent;\n  color: var(--menu-accent);\n  font: inherit;\n  font-weight: 600;\n  cursor: pointer;\n  max-width: 100%;\n  overflow-wrap: anywhere;\n}\n.pm button:enabled:hover {\n  background: color-mix(in srgb, var(--menu-accent) 9%, transparent);\n}\n.pm button:disabled {\n  opacity: 0.45;\n  cursor: default;\n}\n.pm :is(button, input, a):focus-visible {\n  outline: 2px solid var(--menu-accent);\n  outline-offset: 2px;\n}\n.pm button.primary {\n  padding-inline: 18px;\n  background: var(--menu-accent);\n  color: var(--primary-foreground, #faf6ef);\n}\n.pm button.primary:enabled:hover {\n  background: color-mix(in srgb, var(--menu-accent) 88%, black);\n}\n.pm button.secondary {\n  background: var(--secondary, #e7dfd3);\n  color: var(--menu-ink);\n}\n.pm button.remove,\n.pm .order button {\n  display: inline-grid;\n  place-items: center;\n  width: 44px;\n  padding: 0;\n  color: var(--menu-muted);\n}\n.pm button.remove {\n  margin-inline-start: auto;\n}\n.pm button.remove:hover {\n  color: var(--destructive, #9b2c1f);\n}\n.pm .order {\n  display: inline-flex;\n  gap: 2px;\n}\n.pm .menu-tabs {\n  gap: 4px;\n  padding-bottom: 8px;\n  border-bottom: 1px solid var(--menu-line);\n}\n.pm .menu-tabs:empty {\n  display: none;\n}\n.pm .menu-tabs button {\n  color: var(--menu-muted);\n  border-radius: 30px;\n  padding-inline: 16px;\n}\n.pm .menu-tabs button[aria-pressed="true"] {\n  color: var(--menu-accent);\n  background: color-mix(in srgb, var(--menu-accent) 10%, var(--menu-paper));\n}\n.pm .course {\n  padding: clamp(16px, 3vw, 26px);\n  border-radius: 16px;\n  background: var(--menu-paper);\n  border: 1px solid var(--menu-line);\n}\n.pm .course h3 {\n  font:\n    600 1.5rem / 1.2 Georgia,\n    serif;\n  margin-bottom: 6px;\n}\n.pm .item {\n  display: grid;\n  gap: 6px;\n  padding-block: 16px;\n}\n.pm .item + .item {\n  border-top: 1px solid var(--menu-line);\n}\n.pm .item:last-child {\n  padding-bottom: 0;\n}\n.pm .item-title {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  gap: 16px;\n  align-items: baseline;\n  font-weight: 650;\n}\n.pm .item-title span:last-child {\n  font-variant-numeric: tabular-nums;\n  color: var(--menu-accent);\n}\n.pm .item p,\n.pm .course > p {\n  white-space: pre-wrap;\n  line-height: 1.55;\n  color: var(--menu-muted);\n}\n.pm small,\n.pm .muted,\n.pm .variant-line {\n  color: var(--menu-muted);\n  font-size: 0.875rem;\n}\n.pm .dietary {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 5px;\n  list-style: none;\n  padding: 0;\n}\n.pm .dietary li {\n  background: var(--secondary, #e7dfd3);\n  padding: 2px 8px;\n  border-radius: 6px;\n  font-size: 0.8rem;\n}\n.pm .item-image {\n  display: block;\n  width: 180px;\n  max-width: 100%;\n  height: 130px;\n  object-fit: cover;\n  border-radius: 10px;\n  margin-block: 5px;\n}\n.pm a {\n  text-decoration: underline;\n}\n.pm [role="alert"] {\n  color: var(--destructive, #9b2c1f);\n}\n.pm .confirm {\n  flex-basis: 100%;\n  padding: 10px;\n  background: var(--menu-paper);\n  border-radius: 10px;\n}\n.pm form,\n.pm fieldset {\n  display: grid;\n  min-width: 0;\n  gap: 16px;\n}\n.pm fieldset {\n  margin: 0;\n  padding: 16px;\n  border: 0;\n  border-radius: 14px;\n  background: color-mix(in srgb, var(--menu-accent) 5%, var(--menu-paper));\n}\n.pm fieldset fieldset {\n  background: var(--menu-paper);\n  border: 1px solid var(--menu-line);\n}\n.pm fieldset fieldset fieldset {\n  border: 0;\n  border-top: 1px solid var(--menu-line);\n  border-radius: 0;\n  padding: 16px 0 0;\n}\n.pm legend {\n  padding: 0 6px;\n  font-weight: 650;\n}\n.pm .row {\n  gap: 12px;\n  align-items: end;\n}\n.pm label {\n  display: grid;\n  gap: 6px;\n  font-size: 0.875rem;\n  font-weight: 600;\n  min-width: 0;\n}\n.pm .row label {\n  flex: 1 1 130px;\n}\n.pm input {\n  width: 100%;\n  min-width: 0;\n  min-height: 44px;\n  padding: 9px 12px;\n  border: 1px solid var(--menu-line);\n  border-radius: 9px;\n  background: #fffdf9;\n  color: var(--menu-ink);\n  font: inherit;\n  font-weight: 400;\n}\n.pm input[type="file"] {\n  padding: 7px;\n  font-size: 0.82rem;\n}\n.pm input::file-selector-button {\n  border: 0;\n  border-radius: 5px;\n  padding: 6px 9px;\n  margin-right: 8px;\n  background: var(--secondary, #e7dfd3);\n  color: var(--menu-ink);\n  cursor: pointer;\n}\n.pm fieldset > button {\n  justify-self: start;\n}\n.pm .actions {\n  gap: 4px;\n}\n@media (max-width: 480px) {\n  .pm fieldset {\n    padding: 12px;\n  }\n  .pm .row label {\n    flex-basis: 110px;\n  }\n  .pm .row.variant {\n    gap: 6px;\n  }\n}\n';

// src/web/shims/react.ts
var bridge = globalThis.__PLACARD_PLUGIN__;
if (!bridge?.React) {
  throw new Error("Placard plugin host bridge missing (React). Rebuild/redeploy the web app.");
}
var R = bridge.React;
var {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useId,
  useLayoutEffect,
  createElement,
  Fragment,
  Children,
  cloneElement,
  isValidElement,
  createContext,
  useContext,
  useReducer,
  memo,
  forwardRef,
  StrictMode
} = R;

// src/web/shims/jsx-runtime.ts
var bridge2 = globalThis.__PLACARD_PLUGIN__;
if (!bridge2?.jsxRuntime) {
  throw new Error("Placard plugin host bridge missing (jsx-runtime). Rebuild/redeploy the web app.");
}
var { jsx, jsxs, Fragment: Fragment2 } = bridge2.jsxRuntime;

// src/web/MenuSection.tsx
async function call(operation, input) {
  const response = await fetch(`/api/m/places.menus/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Could not save menu");
  return data;
}
function menuInput(menu) {
  const { id, placeId, revision, updatedAt, ...input } = menu;
  return input;
}
function move(items, index, delta) {
  const next = [...items];
  const to = index + delta;
  if (to < 0 || to >= next.length) return next;
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
function RemoveButton({
  label,
  disabled,
  onClick
}) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      className: "remove",
      type: "button",
      "aria-label": label,
      title: label,
      disabled,
      onClick,
      children: /* @__PURE__ */ jsx(
        "svg",
        {
          "aria-hidden": "true",
          width: "18",
          height: "18",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "1.7",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          children: /* @__PURE__ */ jsx("path", { d: "M4 7h16M10 11v6m4-6v6M5.5 7l1 12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2l1-12M9 7V4h6v3" })
        }
      )
    }
  );
}
function Order({
  index,
  length,
  change
}) {
  if (length < 2) return null;
  return /* @__PURE__ */ jsxs("span", { className: "order", children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        title: "Move up",
        "aria-label": "Move up",
        disabled: index === 0,
        onClick: () => change(-1),
        children: "\u2191"
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        title: "Move down",
        "aria-label": "Move down",
        disabled: index === length - 1,
        onClick: () => change(1),
        children: "\u2193"
      }
    )
  ] });
}
function Field({
  label,
  value,
  change,
  required = false
}) {
  return /* @__PURE__ */ jsxs("label", { children: [
    label,
    /* @__PURE__ */ jsx(
      "input",
      {
        required,
        value: value ?? "",
        onChange: (event) => change(event.target.value)
      }
    )
  ] });
}
function imageUrl(placeId, imageId) {
  return `/api/m/places.menus/images/${placeId}/${imageId}`;
}
function ItemImage({
  placeId,
  item,
  change,
  setBusy
}) {
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  async function upload(file) {
    setError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPEG, PNG or WebP image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image is too large (max 5 MB)");
      return;
    }
    setUploading(true);
    setBusy(true);
    try {
      const response = await fetch(`/api/m/places.menus/images/${placeId}`, {
        method: "POST",
        headers: { "content-type": file.type },
        body: file
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not upload image");
      change(data.imageId);
    } catch (error2) {
      setError(error2 instanceof Error ? error2.message : "Could not upload image");
    } finally {
      setUploading(false);
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("label", { children: [
      item.imageId ? "Replace item image" : "Item image",
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "file",
          accept: "image/jpeg,image/png,image/webp",
          onChange: (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }
        }
      )
    ] }),
    /* @__PURE__ */ jsx("small", { children: "JPEG, PNG or WebP, up to 5 MB. Save the menu to keep your changes." }),
    uploading && /* @__PURE__ */ jsx("p", { role: "status", children: "Uploading image\u2026" }),
    error && /* @__PURE__ */ jsx("p", { role: "alert", children: error }),
    item.imageId && /* @__PURE__ */ jsxs(Fragment2, { children: [
      /* @__PURE__ */ jsx(
        "img",
        {
          className: "item-image",
          src: imageUrl(placeId, item.imageId),
          alt: item.name || "Item image preview"
        }
      ),
      /* @__PURE__ */ jsx("button", { type: "button", onClick: () => change(void 0), children: "Remove image" })
    ] })
  ] });
}
var optional = (value) => value || void 0;
function MenuSection({ placeId, category, isOwner }) {
  const [menus, setMenus] = useState(null);
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState(null);
  useEffect(() => {
    let current = true;
    setMenus(null);
    setDraft(null);
    setError(null);
    setActive(null);
    call("get_menus", { placeId }).then((value) => {
      if (current) setMenus(value);
    }).catch((error2) => {
      if (current) setError(error2.message);
    });
    return () => {
      current = false;
    };
  }, [placeId]);
  async function mutate(operation, input) {
    const fingerprint = JSON.stringify({ operation, input });
    const requestId = pending?.fingerprint === fingerprint ? pending.requestId : crypto.randomUUID();
    setPending({ fingerprint, requestId });
    setBusy(true);
    setError(null);
    try {
      const result = await call(operation, { ...input, requestId });
      const next = await call("get_menus", { placeId });
      setMenus(next);
      setActive(result.id ?? null);
      setDraft(null);
      setConfirmDelete(false);
      setPending(null);
    } catch (error2) {
      setError(error2 instanceof Error ? error2.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  const selected = menus?.find((menu) => menu.id === active) ?? menus?.[0];
  if (menus?.length === 0 && !["restaurant", "cafe", "bar"].includes(category)) return null;
  function create() {
    setDraft({
      id: crypto.randomUUID(),
      placeId,
      name: "",
      revision: 0,
      updatedAt: "",
      sortOrder: menus?.length ?? 0,
      sections: []
    });
    setError(null);
  }
  function updateSection(index, section) {
    if (draft)
      setDraft({
        ...draft,
        sections: draft.sections.map((old, i) => i === index ? section : old)
      });
  }
  function save(menu) {
    return mutate("save_menu", {
      placeId,
      ...menu.revision ? { menuId: menu.id, expectedRevision: menu.revision } : {},
      menu: menuInput(menu)
    });
  }
  return /* @__PURE__ */ jsxs("section", { className: "pm", "aria-label": "Menus", children: [
    /* @__PURE__ */ jsx("style", { children: menu_default }),
    /* @__PURE__ */ jsxs("header", { children: [
      /* @__PURE__ */ jsx("h2", { children: "Menus" }),
      isOwner && !draft && /* @__PURE__ */ jsx("button", { className: "primary", onClick: create, disabled: busy, children: "+ Add menu" })
    ] }),
    error && /* @__PURE__ */ jsxs("p", { role: "alert", children: [
      error,
      " ",
      /* @__PURE__ */ jsx(
        "button",
        {
          disabled: busy,
          onClick: () => {
            void call("get_menus", { placeId }).then((value) => {
              setMenus(value);
              setDraft(null);
              setError(null);
            }).catch((e) => setError(e.message));
          },
          children: "Reload menus"
        }
      )
    ] }),
    !menus && !error && /* @__PURE__ */ jsx("p", { role: "status", children: "Loading menus\u2026" }),
    menus?.length === 0 && !draft && /* @__PURE__ */ jsx("p", { className: "muted", children: "No menu yet. Add one manually or ask your connected AI assistant to import one through MCP." }),
    !draft && /* @__PURE__ */ jsxs(Fragment2, { children: [
      /* @__PURE__ */ jsx("div", { className: "menu-tabs", role: "group", "aria-label": "Choose menu", children: menus?.map((menu) => /* @__PURE__ */ jsx(
        "button",
        {
          "aria-pressed": selected?.id === menu.id,
          onClick: () => {
            setActive(menu.id);
            setConfirmDelete(false);
          },
          children: menu.name
        },
        menu.id
      )) }),
      selected && /* @__PURE__ */ jsxs(Fragment2, { children: [
        selected.notes && /* @__PURE__ */ jsx("p", { children: selected.notes }),
        selected.sections.map((section) => /* @__PURE__ */ jsxs("div", { className: "course", children: [
          /* @__PURE__ */ jsx("h3", { children: section.name }),
          section.notes && /* @__PURE__ */ jsx("p", { children: section.notes }),
          section.items.map((item) => /* @__PURE__ */ jsxs("div", { className: "item", children: [
            /* @__PURE__ */ jsxs("div", { className: "item-title", children: [
              /* @__PURE__ */ jsx("span", { children: item.name }),
              /* @__PURE__ */ jsx("span", { children: item.price ? `${item.price} ${selected.currency ?? ""}` : "" })
            ] }),
            item.imageId && /* @__PURE__ */ jsx(
              "img",
              {
                className: "item-image",
                src: imageUrl(placeId, item.imageId),
                alt: item.name,
                loading: "lazy"
              }
            ),
            item.description && /* @__PURE__ */ jsx("p", { children: item.description }),
            item.variants.map((variant, i) => /* @__PURE__ */ jsxs("p", { className: "variant-line", children: [
              variant.name,
              ": ",
              variant.price,
              " ",
              selected.currency
            ] }, i)),
            item.dietaryLabels.length > 0 && /* @__PURE__ */ jsx("ul", { className: "dietary", children: item.dietaryLabels.map((label, index) => /* @__PURE__ */ jsx("li", { children: label }, index)) }),
            item.notes && /* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("small", { children: item.notes }) })
          ] }, item.id))
        ] }, section.id)),
        /* @__PURE__ */ jsxs("small", { children: [
          "Updated ",
          new Date(selected.updatedAt).toLocaleDateString(),
          selected.sourceUrl && /* @__PURE__ */ jsxs(Fragment2, { children: [
            " ",
            "\xB7",
            " ",
            /* @__PURE__ */ jsx("a", { href: selected.sourceUrl, target: "_blank", rel: "noopener noreferrer", children: "View source" })
          ] })
        ] }),
        isOwner && /* @__PURE__ */ jsxs("div", { className: "actions", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              className: "secondary",
              disabled: busy,
              onClick: () => setDraft(structuredClone(selected)),
              children: "Edit menu"
            }
          ),
          /* @__PURE__ */ jsx(
            Order,
            {
              index: menus.indexOf(selected),
              length: menus.length,
              change: (delta) => {
                const index = menus.indexOf(selected) + delta;
                void save({ ...selected, sortOrder: index });
              }
            }
          ),
          !confirmDelete && /* @__PURE__ */ jsx(
            RemoveButton,
            {
              label: "Delete menu",
              disabled: busy,
              onClick: () => setConfirmDelete(true)
            }
          ),
          confirmDelete && /* @__PURE__ */ jsxs("div", { className: "confirm", children: [
            /* @__PURE__ */ jsxs("span", { children: [
              "Delete ",
              selected.name,
              "?"
            ] }),
            /* @__PURE__ */ jsx(
              "button",
              {
                disabled: busy,
                onClick: () => void mutate("delete_menu", {
                  placeId,
                  menuId: selected.id,
                  expectedRevision: selected.revision
                }),
                children: "Confirm delete"
              }
            ),
            /* @__PURE__ */ jsx("button", { onClick: () => setConfirmDelete(false), children: "Keep menu" })
          ] })
        ] })
      ] })
    ] }),
    draft && /* @__PURE__ */ jsx(
      "form",
      {
        onSubmit: (event) => {
          event.preventDefault();
          void save(draft);
        },
        children: /* @__PURE__ */ jsxs("fieldset", { disabled: busy, children: [
          /* @__PURE__ */ jsx("legend", { children: draft.revision ? "Edit menu" : "New menu" }),
          /* @__PURE__ */ jsxs("div", { className: "row", children: [
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Menu name",
                required: true,
                value: draft.name,
                change: (name) => setDraft({ ...draft, name })
              }
            ),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Currency (e.g. EUR)",
                value: draft.currency,
                change: (currency) => setDraft({ ...draft, currency: optional(currency.toUpperCase()) })
              }
            )
          ] }),
          /* @__PURE__ */ jsx(
            Field,
            {
              label: "Source URL",
              value: draft.sourceUrl,
              change: (sourceUrl) => setDraft({ ...draft, sourceUrl: optional(sourceUrl) })
            }
          ),
          /* @__PURE__ */ jsx(
            Field,
            {
              label: "Menu notes",
              value: draft.notes,
              change: (notes) => setDraft({ ...draft, notes: optional(notes) })
            }
          ),
          draft.sections.map((section, sectionIndex) => /* @__PURE__ */ jsxs("fieldset", { children: [
            /* @__PURE__ */ jsxs("legend", { children: [
              "Section ",
              sectionIndex + 1
            ] }),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Section name",
                required: true,
                value: section.name,
                change: (name) => updateSection(sectionIndex, { ...section, name })
              }
            ),
            /* @__PURE__ */ jsx(
              Field,
              {
                label: "Section notes",
                value: section.notes,
                change: (notes) => updateSection(sectionIndex, { ...section, notes: optional(notes) })
              }
            ),
            /* @__PURE__ */ jsxs("div", { className: "actions", children: [
              /* @__PURE__ */ jsx(
                Order,
                {
                  index: sectionIndex,
                  length: draft.sections.length,
                  change: (delta) => setDraft({ ...draft, sections: move(draft.sections, sectionIndex, delta) })
                }
              ),
              /* @__PURE__ */ jsx(
                RemoveButton,
                {
                  label: "Remove section",
                  onClick: () => setDraft({
                    ...draft,
                    sections: draft.sections.filter((_, i) => i !== sectionIndex)
                  })
                }
              )
            ] }),
            section.items.map((item, itemIndex) => {
              const change = (patch) => updateSection(sectionIndex, {
                ...section,
                items: section.items.map(
                  (old, i) => i === itemIndex ? { ...old, ...patch } : old
                )
              });
              return /* @__PURE__ */ jsxs("fieldset", { children: [
                /* @__PURE__ */ jsxs("legend", { children: [
                  "Item ",
                  itemIndex + 1
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "row", children: [
                  /* @__PURE__ */ jsx(
                    Field,
                    {
                      label: "Item name",
                      required: true,
                      value: item.name,
                      change: (name) => change({ name })
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Field,
                    {
                      label: "Price",
                      value: item.price,
                      change: (price) => change({ price: optional(price) })
                    }
                  )
                ] }),
                /* @__PURE__ */ jsx(
                  ItemImage,
                  {
                    placeId,
                    item,
                    setBusy,
                    change: (imageId) => setDraft(
                      (current) => current && {
                        ...current,
                        sections: current.sections.map(
                          (entry) => entry.id !== section.id ? entry : {
                            ...entry,
                            items: entry.items.map(
                              (old) => old.id !== item.id ? old : { ...old, imageId }
                            )
                          }
                        )
                      }
                    )
                  }
                ),
                /* @__PURE__ */ jsx(
                  Field,
                  {
                    label: "Description",
                    value: item.description,
                    change: (description) => change({ description: optional(description) })
                  }
                ),
                /* @__PURE__ */ jsx(
                  Field,
                  {
                    label: "Item notes",
                    value: item.notes,
                    change: (notes) => change({ notes: optional(notes) })
                  }
                ),
                /* @__PURE__ */ jsx(
                  Field,
                  {
                    label: "Dietary labels (comma separated, only if stated)",
                    value: item.dietaryLabels.join(", "),
                    change: (value) => change({
                      dietaryLabels: value ? value.split(",").map((v) => v.trim()) : []
                    })
                  }
                ),
                item.variants.map((variant, vi) => /* @__PURE__ */ jsxs("div", { className: "row variant", children: [
                  /* @__PURE__ */ jsx(
                    Field,
                    {
                      label: "Variant name",
                      required: true,
                      value: variant.name,
                      change: (name) => change({
                        variants: item.variants.map(
                          (v, i) => i === vi ? { ...v, name } : v
                        )
                      })
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Field,
                    {
                      label: "Variant price",
                      required: true,
                      value: variant.price,
                      change: (price) => change({
                        variants: item.variants.map(
                          (v, i) => i === vi ? { ...v, price } : v
                        )
                      })
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    RemoveButton,
                    {
                      label: "Remove variant",
                      onClick: () => change({ variants: item.variants.filter((_, i) => i !== vi) })
                    }
                  )
                ] }, vi)),
                /* @__PURE__ */ jsxs("div", { className: "actions", children: [
                  /* @__PURE__ */ jsx(
                    "button",
                    {
                      type: "button",
                      onClick: () => change({ variants: [...item.variants, { name: "", price: "" }] }),
                      children: "Add variant"
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    Order,
                    {
                      index: itemIndex,
                      length: section.items.length,
                      change: (delta) => updateSection(sectionIndex, {
                        ...section,
                        items: move(section.items, itemIndex, delta)
                      })
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    RemoveButton,
                    {
                      label: "Remove item",
                      onClick: () => updateSection(sectionIndex, {
                        ...section,
                        items: section.items.filter((_, i) => i !== itemIndex)
                      })
                    }
                  )
                ] })
              ] }, item.id);
            }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => updateSection(sectionIndex, {
                  ...section,
                  items: [
                    ...section.items,
                    { id: crypto.randomUUID(), name: "", variants: [], dietaryLabels: [] }
                  ]
                }),
                children: "Add item"
              }
            )
          ] }, section.id)),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setDraft({
                ...draft,
                sections: [...draft.sections, { id: crypto.randomUUID(), name: "", items: [] }]
              }),
              children: "Add section"
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "actions", children: [
            /* @__PURE__ */ jsx("button", { className: "primary", type: "submit", children: busy ? "Saving\u2026" : "Save menu" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: () => {
                  setDraft(null);
                  setError(null);
                },
                children: "Cancel"
              }
            )
          ] })
        ] })
      }
    )
  ] });
}
export {
  MenuSection
};
