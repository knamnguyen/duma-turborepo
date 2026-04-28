"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical, Lock } from "lucide-react";
import {
  BUILTIN_FIELDS,
  OPTIONAL_PREDEFINED_FIELDS,
  FIELD_TYPES,
  type FormField,
} from "@/lib/form-schema";

function generateFieldId() {
  return "field_" + Math.random().toString(36).substring(2, 10);
}

export function FormBuilder({
  value,
  onChange,
}: {
  value: FormField[];
  onChange: (schema: FormField[]) => void;
}) {
  // Track which predefined optional fields are enabled
  const enabledPredefinedIds = new Set(
    value.filter((f) => !f.builtin).map((f) => f.id)
  );
  const customFields = value.filter(
    (f) =>
      !f.builtin &&
      !OPTIONAL_PREDEFINED_FIELDS.some((p) => p.id === f.id)
  );

  const togglePredefined = (field: FormField) => {
    if (enabledPredefinedIds.has(field.id)) {
      onChange(value.filter((f) => f.id !== field.id));
    } else {
      // Insert before custom fields
      const builtins = value.filter((f) => f.builtin);
      const predefined = value.filter(
        (f) =>
          !f.builtin && OPTIONAL_PREDEFINED_FIELDS.some((p) => p.id === f.id)
      );
      onChange([...builtins, ...predefined, field, ...customFields]);
    }
  };

  const addCustomField = () => {
    const newField: FormField = {
      id: generateFieldId(),
      type: "text",
      label: "",
      required: false,
      builtin: false,
    };
    onChange([...value, newField]);
  };

  const updateCustomField = (id: string, updates: Partial<FormField>) => {
    onChange(
      value.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeCustomField = (id: string) => {
    onChange(value.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Built-in fields */}
      <div>
        <Label className="text-xs text-white/50 uppercase tracking-wider">
          Required Fields
        </Label>
        <div className="mt-2 space-y-1.5">
          {BUILTIN_FIELDS.map((field) => (
            <div
              key={field.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10"
            >
              <Lock className="w-3 h-3 text-white/30" />
              <span className="text-sm text-white/70">{field.label}</span>
              <span className="text-[10px] text-white/30 ml-auto">
                {field.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Optional predefined fields */}
      <div>
        <Label className="text-xs text-white/50 uppercase tracking-wider">
          Optional Fields
        </Label>
        <div className="mt-2 space-y-1.5">
          {OPTIONAL_PREDEFINED_FIELDS.map((field) => {
            const enabled = enabledPredefinedIds.has(field.id);
            return (
              <button
                key={field.id}
                type="button"
                onClick={() => togglePredefined(field)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border w-full text-left transition-all ${
                  enabled
                    ? "bg-purple-500/10 border-purple-500/30 text-white"
                    : "bg-white/5 border-white/10 text-white/50 hover:border-white/20"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    enabled
                      ? "border-purple-500 bg-purple-500"
                      : "border-white/30"
                  }`}
                >
                  {enabled && (
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-sm">{field.label}</span>
                <span className="text-[10px] text-white/30 ml-auto">
                  {field.type}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom fields */}
      {customFields.length > 0 && (
        <div>
          <Label className="text-xs text-white/50 uppercase tracking-wider">
            Custom Questions
          </Label>
          <div className="mt-2 space-y-3">
            {customFields.map((field) => (
              <CustomFieldEditor
                key={field.id}
                field={field}
                onUpdate={(updates) =>
                  updateCustomField(field.id, updates)
                }
                onRemove={() => removeCustomField(field.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add custom question button */}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={addCustomField}
        className="w-full"
      >
        <Plus className="w-4 h-4" />
        Add Question
      </Button>
    </div>
  );
}

function CustomFieldEditor({
  field,
  onUpdate,
  onRemove,
}: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-white/20 shrink-0" />
        <Input
          placeholder="Question label"
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="text-sm h-8 flex-1"
        />
        <select
          value={field.type}
          onChange={(e) =>
            onUpdate({ type: e.target.value as FormField["type"] })
          }
          className="h-8 px-2 rounded-md bg-white/5 border border-white/10 text-xs text-white/70"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="text-white/30 hover:text-red-400 transition-colors p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 pl-6">
        <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdate({ required: e.target.checked })}
            className="rounded"
          />
          Required
        </label>
      </div>

      {field.type === "select" && (
        <div className="pl-6">
          <Input
            placeholder="Options (comma-separated): Yes, No, Maybe"
            value={(field.options || []).join(", ")}
            onChange={(e) =>
              onUpdate({
                options: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="text-xs h-7"
          />
        </div>
      )}
    </div>
  );
}
