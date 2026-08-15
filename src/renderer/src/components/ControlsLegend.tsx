interface LegendItem {
  key: string
  label: string
  tone?: 'accent' | 'amber' | 'neutral'
}

interface Props {
  items: LegendItem[]
}

export default function ControlsLegend({ items }: Props): JSX.Element {
  return (
    <div className="controls-legend">
      {items.map((item) => (
        <div className="controls-legend-item" key={item.key + item.label}>
          <span
            className={`controls-legend-key controls-legend-key--${item.tone ?? 'neutral'}${
              item.key.length > 1 ? ' controls-legend-key--wide' : ''
            }`}
          >
            {item.key}
          </span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}
