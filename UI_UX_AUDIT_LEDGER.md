# Rhythm UI/UX audit ledger

Final motion/responsive/polish review for the `codex/motion-final-polish` base. Evidence below is limited to the current source, focused tests, and the browser smoke checks recorded with this change.

| Original plan finding | Status | Evidence |
| --- | --- | --- |
| Work-item completion/create/delete lifecycle | FIXED | Stable task IDs are retained through `ViewTransition`; list rows hold an exit state for 240ms; check, enter, and exit tokens are defined in `app/globals.css`; reduced motion removes animation. |
| Dialog, search, proposal, suggestion, and navigation exits | FIXED | `Dialog` keeps native dialogs open for the 180ms close window, clears a pending close timer on reopen, and the shared CSS covers dialog, search result, proposal, suggestion, and active-nav transitions. |
| Continuous atmospheric motion | FIXED | Grain is static; chat orb no longer loops; Rhythm orbit is CSS-only and runs only while its `IntersectionObserver` marks it visible. Reduced motion disables all animation and transitions. |
| Mobile navigation and named search | FIXED | At `max-width: 767px`, navigation uses five equal grid columns and Search remains a named top-bar action. |
| Tablet rail discoverability and panel clipping | FIXED | The 768–1099px rail exposes title tooltips on hover/focus; wide workspace panels scroll within their own bounds. |
| Small-screen sheets and calendar agenda | FIXED | Sheets use safe-area padding, internal scroll, and sticky occurrence actions at `max-width: 520px`; Calendar shows a seven-day agenda below 768px and retains provider event/conflict surfaces below it. |
| Responsive action hierarchy | PARTIALLY FIXED | Today and Tasks now expose quiet contextual Ask Rhythm actions near the primary content; Rhythms keeps its existing primary New rhythm action. Further product-specific hierarchy tuning is not evidenced here. |
| Overdue, conflict, zero-work, timezone-change, and filtered-empty states | FIXED | Tasks keeps an explicit Overdue group; provider conflicts are labelled in event cards; existing empty states remain; timezone review is dismissible and local-only; filtered-empty has a distinct clear-filters action. |
| Recurrence-heavy task inventory | FIXED | `selectTaskInventory` keeps all manual tasks visible, bounds generated occurrences to a date window, reports the hidden generated-open count, and provides a Show more range control. The pure helper has a focused test. |
| Completed/history initial rendering | FIXED | Completed rows initially render in a bounded batch with an explicit Show 40 more action; open manual tasks are not capped by that control. |
| Embedded Ask Rhythm entry points | FIXED | Today and Tasks link to `/chat` with contextual prefilled prompts. `/chat` already reads the prompt query parameter and no proactive message is sent. |
| Factual microcopy and semantic surface roles | PARTIALLY FIXED | “Live tasks” and “Live reflection” were replaced with factual labels; task/capability and provider surfaces use lime, peach, violet, or neutral glass roles. Some legacy copy remains outside this touched scope and needs product copy review. |
| Accessibility final pass | PARTIALLY FIXED | Focus rings, labelled controls, semantic time/list/status roles, reduced motion, and 44px targets are present; supporting calendar/task text was raised to 11px desktop and 12px mobile. A full assistive-technology audit is still outside automated evidence. |
| Performance cleanup | FIXED | Removed the unused GSAP dependency and replaced page/orb loops with CSS entry motion and visibility-aware orbit motion. |

## Intentional exclusions

The following are intentionally not implemented in this phase: reliable background notifications, voice input, drag scheduling, custom/monthly recurrence, separate Projects/Notifications pages.

## Verification evidence

The local browser smoke covered `/`, `/tasks`, `/calendar`, `/rhythms`, `/chat`, and `/settings` at 320×568 and 834×1112, plus Today at 1440×1000 and 390×844. `document.body.scrollWidth` did not exceed the viewport width in those checks. Calendar rendered seven agenda day sections at 390px, the desktop calendar grid was hidden below 768px, and the five mobile nav columns were equal width. Search opened with its combobox focused and Escape returned focus to Search Rhythm after the 180ms exit. No browser console errors or warnings were captured. The in-app browser did not expose a reduced-motion emulation control, so reduced-motion verification is source/CSS-based rather than runtime-emulated.

## Open risks

No Critical finding remains open in this ledger. Remaining risk is limited to browser/assistive-technology differences in native dialog animation, View Transition support, and provider data availability; the app remains usable when those platform features are unavailable.
