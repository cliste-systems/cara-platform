"use client";
import {Select} from "@base-ui/react/select";
import {Check,ChevronDown,CircleAlert} from "lucide-react";
import {IRISH_COUNTIES} from "@/lib/irish-counties";
import {signupBody} from "@/components/onboarding/brand-fonts";
import styles from "./setup-business-step.module.css";
const options=IRISH_COUNTIES.map(value=>({value,label:value}));
export function SetupCountySelect({id,value,onChange,error}:{id:string;value:string;onChange:(value:string)=>void;error:boolean}) {
 return <div className={styles.field} data-county-field>
  <label htmlFor={id}>County</label>
  <input type="hidden" name="county" value={value}/>
  <Select.Root items={options} value={value||null} onValueChange={next=>onChange(next??"")}>
   <Select.Trigger id={id} aria-required="true" aria-invalid={error} aria-describedby={error?`${id}-error`:undefined} className={styles.selectTrigger}>
    <Select.Value placeholder="Select county"/><Select.Icon><ChevronDown size={16} aria-hidden/></Select.Icon>
   </Select.Trigger>
   <Select.Portal><Select.Positioner sideOffset={8} alignItemWithTrigger={false} className={styles.selectPositioner}>
    <Select.Popup className={`${styles.selectPopup} ${signupBody.className}`}>
     <Select.List>{options.map(option=><Select.Item key={option.value} value={option.value} className={styles.selectOption}>
      <Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator><Check size={16} aria-hidden/></Select.ItemIndicator>
     </Select.Item>)}</Select.List>
    </Select.Popup>
   </Select.Positioner></Select.Portal>
  </Select.Root>
  {error&&<span id={`${id}-error`} role="alert" data-field-error className={styles.countyError}><CircleAlert size={14} aria-hidden/>Choose your county.</span>}
 </div>;
}
