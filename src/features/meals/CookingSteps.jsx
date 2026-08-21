import { useState } from 'react';
import { Field, Input, cx } from '../../components/ui.jsx';
import { RowButtons, StringRows } from './formParts.jsx';
import { useToast } from '../../components/Toast.jsx';

const BLANK = { text: '', timeEstimate: null, image: null, videoUrl: '' };

/**
 * Cooking steps — the food-item list on the left, rich instruction cards
 * on the right, mirroring the production layout.
 */
export default function CookingSteps({ foodItems, instructions, onFoodItems, onInstructions }) {
  const toast = useToast();
  const setAt = (i, patch) =>
    onInstructions(instructions.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const addAt = (i) =>
    onInstructions([...instructions.slice(0, i + 1), { ...BLANK }, ...instructions.slice(i + 1)]);
  const removeAt = (i) => onInstructions(instructions.filter((_, n) => n !== i));

  const pickImage = (i, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setAt(i, { image: e.target.result });
    reader.readAsDataURL(file);
  };

  return (
    <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-5 max-lg:grid-cols-1">
      <div>
        <h4 className="mb-2 text-[13px] font-semibold text-ink">Food items</h4>
        <StringRows items={foodItems} onChange={onFoodItems}
          placeholder="e.g. 2 cups black-eyed peas" emptyLabel="Add the first food item" />
      </div>

      <div>
        <h4 className="mb-2 text-[13px] font-semibold text-ink">Instructions</h4>
        {!instructions.length ? (
          <button type="button" onClick={() => onInstructions([{ ...BLANK }])}
            className="w-full cursor-pointer rounded-xl border border-dashed border-line py-5 text-[13px] text-ink-3 transition hover:border-mint hover:text-forest">
            + Add the first step
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            {instructions.map((step, i) => (
              <div key={i} className="rounded-xl border border-line-light bg-surface-2 p-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-forest text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="text-[12px] font-medium text-ink-2">Step {i + 1}</span>
                </div>

                <Field>
                  <textarea
                    rows={2}
                    value={step.text}
                    onChange={(e) => setAt(i, { text: e.target.value })}
                    placeholder="Describe this step"
                    className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] text-ink outline-none transition placeholder:text-ink-3 focus:border-mint focus:ring-3 focus:ring-mint/8"
                  />
                </Field>

                <div className="mt-2 grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                  <Field label="Time estimate" hint="minutes">
                    <Input type="number" min="0" placeholder="—" value={step.timeEstimate ?? ''}
                      onChange={(e) => setAt(i, { timeEstimate: e.target.value === '' ? null : Number(e.target.value) })} />
                  </Field>
                  <Field label="Video URL" hint="optional">
                    <Input value={step.videoUrl ?? ''} placeholder="https://…"
                      onChange={(e) => setAt(i, { videoUrl: e.target.value })} />
                  </Field>
                </div>

                <div className="mt-2">
                  <span className="text-xs font-medium text-ink-2">Step image <span className="text-[10px] font-normal text-ink-3">optional</span></span>
                  <div className="mt-1.5 flex items-start gap-2">
                    <label className="relative grid h-20 w-32 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed border-line bg-surface transition hover:border-mint">
                      {step.image ? (
                        <img src={step.image} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="text-[11px] text-ink-3">Choose image</span>
                      )}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => pickImage(i, e.target.files?.[0])} />
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {step.image && (
                        <button type="button" onClick={() => setAt(i, { image: null })}
                          className="cursor-pointer rounded-md border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-ink-2 transition hover:border-chili hover:text-chili">
                          Remove image
                        </button>
                      )}
                      {/* Present because the production form has it, but honest:
                          it needs an image-generation endpoint that this build
                          has no credentials for. */}
                      <button type="button"
                        onClick={() => toast('Image generation needs an image endpoint — not configured')}
                        title="Requires an image-generation endpoint"
                        className="cursor-pointer rounded-md border border-dashed border-line px-2.5 py-1.5 text-[11.5px] font-medium text-ink-3 transition hover:border-mint hover:text-forest">
                        Generate image
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-2">
                  <RowButtons onDelete={() => removeAt(i)} onAdd={() => addAt(i)}
                    disableDelete={instructions.length === 1} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
