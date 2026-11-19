"use client";

import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { SERVICE_CALL_OUTCOMES } from "@/lib/service-calls";
import styles from "./calls-outcome-select.module.css";

const options = [{ value: "", label: "All outcomes" }, ...SERVICE_CALL_OUTCOMES];

export function CallsOutcomeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Select.Root value={value} onValueChange={next => onChange(next ?? "")} items={options}>
    <Select.Trigger className={styles.trigger} aria-label="Filter calls by outcome">
      <Select.Value className={styles.value}/><Select.Icon className={styles.icon}><ChevronDown aria-hidden="true"/></Select.Icon>
    </Select.Trigger>
    <Select.Portal><Select.Positioner align="end" sideOffset={10} collisionPadding={16} alignItemWithTrigger={false} className={styles.positioner}>
      <Select.Popup className={styles.popup}><Select.List className={styles.list}>
        {options.map(option => <Select.Item key={option.value} value={option.value} className={styles.item}>
          <Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator className={styles.indicator}><Check aria-hidden="true"/></Select.ItemIndicator>
        </Select.Item>)}
      </Select.List></Select.Popup>
    </Select.Positioner></Select.Portal>
  </Select.Root>;
}
