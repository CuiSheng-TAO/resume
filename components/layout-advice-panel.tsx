import type { LayoutAdvice, LayoutSuggestion } from "@/lib/layout-advice";

type LayoutAdvicePanelProps = {
  advice: LayoutAdvice;
  onApply: (suggestion: LayoutSuggestion) => void;
  onApplySequence: (suggestions: LayoutSuggestion[]) => void;
};

export function LayoutAdvicePanel({
  advice,
  onApply,
  onApplySequence,
}: LayoutAdvicePanelProps) {
  if (advice.suggestions.length === 0) {
    return null;
  }

  return (
    <section className="studio-block">
      <div className="block-heading">
        <div>
          <p className="block-kicker">建议</p>
          <h3>单页建议</h3>
        </div>
      </div>
      <ul className="advice-reasons">
        {advice.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {advice.sequence.length > 0 ? (
        <section className="advice-sequence">
          <p className="block-kicker">预览</p>
          <h4>本轮预演</h4>
          <ol className="advice-sequence-list">
            {advice.sequence.map((suggestion) => (
              <li key={suggestion.id}>{suggestion.title}</li>
            ))}
          </ol>
          <p className="inline-note">这是基于当前规则的保守调整序列，需你确认后才会批量应用。</p>
          <button
            className="primary-button"
            onClick={() => onApplySequence(advice.sequence)}
            type="button"
          >
            一次应用本轮建议
          </button>
        </section>
      ) : null}
      <div className="advice-list">
        {advice.suggestions.map((suggestion) => (
          <article className="advice-card" key={suggestion.id}>
            <div>
              <strong>{suggestion.title}</strong>
              <p className="block-copy">{suggestion.description}</p>
            </div>
            <button
              className="secondary-button"
              onClick={() => onApply(suggestion)}
              type="button"
            >
              {suggestion.actionLabel}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
