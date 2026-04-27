import * as RadixTooltip from '@radix-ui/react-tooltip'
import styles from './ui.module.css'

export function Tooltip({ children, label, side = 'bottom', sideOffset = 6, ...props }) {
  return (
    <RadixTooltip.Provider delayDuration={400}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>
          {children}
        </RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className={styles.tooltip} side={side} sideOffset={sideOffset} {...props}>
            {label}
            <RadixTooltip.Arrow className={styles.tooltipArrow} />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}
