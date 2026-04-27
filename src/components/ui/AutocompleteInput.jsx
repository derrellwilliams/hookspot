import { useId } from 'react'
import { Input } from './Input.jsx'

export function AutocompleteInput({ suggestions = [], ...props }) {
  const listId = useId()
  return (
    <>
      <Input list={listId} {...props} />
      <datalist id={listId}>
        {suggestions.map(s => <option key={s} value={s} />)}
      </datalist>
    </>
  )
}
