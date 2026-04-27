import { useState } from 'react'
import { Input } from './Input.jsx'
import { Select } from './Select.jsx'

export function SelectWithCustom({ value = '', onChange = () => {}, suggestions = [], placeholder = 'Select…' }) {
  const [isCustom, setIsCustom] = useState(false)

  function handleSelectChange(e) {
    if (e.target.value === '__custom__') {
      setIsCustom(true)
      onChange({ target: { value: '' } })
    } else {
      onChange(e)
    }
  }

  function handleInputBlur() {
    setIsCustom(false)
  }

  function handleInputKeyDown(e) {
    if (e.key === 'Enter' || e.key === 'Escape') setIsCustom(false)
  }

  if (isCustom) {
    return (
      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
      />
    )
  }

  const allOptions = [...new Set(suggestions)]
  const hasCustomValue = value && !allOptions.includes(value)

  return (
    <Select value={value} onChange={handleSelectChange}>
      <option value="">{placeholder}</option>
      {allOptions.map(s => <option key={s} value={s}>{s}</option>)}
      {hasCustomValue && <option value={value}>{value}</option>}
      <option value="__custom__">Add new…</option>
    </Select>
  )
}
