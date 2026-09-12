import homeFilledIcon from '../assets/home-filled.svg'
import {
  pendingItems,
  type PendingItem,
  type DashboardSection,
  type LoginOptionId,
} from '../data/dashboard'

type MainDashboardProps = {
  activeSection: DashboardSection['id']
  onLogout: () => void
  onSectionSelect: (sectionId: DashboardSection['id']) => void
  role: LoginOptionId
  sections: readonly DashboardSection[]
}

export function MainDashboard({
  activeSection,
  onLogout,
  onSectionSelect,
  role,
  sections,
}: MainDashboardProps) {
  const currentSection =
    sections.find((section) => section.id === activeSection) ?? sections[0]
  const roleMode = role === 'employee' ? 'employee' : 'lawyer'
  const roleLabel = role === 'employee' ? 'Funcionario da empresa' : 'Advogado externo'

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-sidebar__brand">
          <span className="brand-mark__icon" />
          <div>
            <strong>EnterOS</strong>
            <p>{roleLabel}</p>
          </div>
        </div>

        <nav className="workspace-nav" aria-label="Navegacao principal">
          {sections.map((section) => {
            const isActive = section.id === activeSection

            return (
              <button
                key={section.id}
                type="button"
                className={`workspace-nav__item${isActive ? ' is-active' : ''}`}
                onClick={() => onSectionSelect(section.id)}
              >
                <img src={homeFilledIcon} alt="" aria-hidden="true" />
                <span>{section.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="workspace-sidebar__footer">
          <button type="button" className="ghost-button" onClick={onLogout}>
            Trocar perfil
          </button>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="workspace-header">
          <div className="workspace-header__main">
            <span className="workspace-header__accent" aria-hidden="true" />
            <div>
              <p className="workspace-header__eyebrow">Tela principal</p>
              <h1 className="titleColor">Boas-vindas</h1>
              <span>{currentSection.heroTitle}</span>
            </div>
          </div>

          <div className="workspace-header__meta">
            <strong>{currentSection.tag}</strong>
            <p>{currentSection.heroDescription}</p>
            <div className="workspace-header__chips">
              <span>{roleLabel}</span>
              <span>{currentSection.label}</span>
            </div>
          </div>
        </header>

        {roleMode === 'employee' ? (
          <EmployeeOverview
            activeSection={activeSection}
            onSectionSelect={onSectionSelect}
            sections={sections}
          />
        ) : (
          <LawyerOverview activeSection={activeSection} onSectionSelect={onSectionSelect} sections={sections} />
        )}
      </section>

      <aside className="workspace-aside">
        <div className="pending-card">
          <div className="pending-card__header">
            <div>
              <p className="pending-card__eyebrow">Fila priorizada</p>
              <h2>Pendencias judiciais</h2>
            </div>
            <span className="pending-card__count">{pendingItems.length} itens</span>
          </div>

          <div className="pending-list">
            {pendingItems.map((item) => (
              <PendingCard key={item.caseNumber} item={item} />
            ))}
          </div>
        </div>
      </aside>
    </main>
  )
}

type OverviewProps = Pick<
  MainDashboardProps,
  'activeSection' | 'onSectionSelect' | 'sections'
>

function EmployeeOverview({
  activeSection,
  onSectionSelect,
  sections,
}: OverviewProps) {
  const metrics = sections.flatMap((section) => section.employeeMetrics)
  const currentSection =
    sections.find((section) => section.id === activeSection) ?? sections[0]

  return (
    <div className="workspace-content">
      <section className="metrics-grid" aria-label="Indicadores principais">
        {metrics.map((metric, index) => (
          <article key={metric.label} className="metric-card">
            <div className="metric-card__top">
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
              <small>{index % 2 === 0 ? 'ultimos 6 ciclos' : 'comparativo semanal'}</small>
            </div>
            <MiniChart values={metric.trend} emphasis="high" />
            <p>{metric.description}</p>
          </article>
        ))}
      </section>

      <section className="insights-grid">
        <article className="detail-card detail-card--wide">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">Resumo operacional</span>
              <h2>{currentSection.label}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => onSectionSelect(currentSection.id)}>
              Tela ativa
            </button>
          </div>

          <p>{currentSection.employeeNarrative}</p>

          <div className="trend-chart" aria-hidden="true">
            {currentSection.employeeTrend.map((height, index) => (
              <span
                key={`${currentSection.id}-${index}`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </article>

        <article className="detail-card">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">Atalhos</span>
              <h2>Explorar telas</h2>
            </div>
          </div>

          <div className="shortcut-list">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`shortcut-card${section.id === activeSection ? ' is-active' : ''}`}
                onClick={() => onSectionSelect(section.id)}
              >
                <strong>{section.label}</strong>
                <span>{section.shortDescription}</span>
              </button>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}

function LawyerOverview({
  activeSection,
  onSectionSelect,
  sections,
}: OverviewProps) {
  const currentSection =
    sections.find((section) => section.id === activeSection) ?? sections[0]

  return (
    <div className="workspace-content">
      <section className="dashboard-grid" aria-label="Dashboard do advogado">
        {sections.map((section) => {
          const isActive = section.id === activeSection

          return (
            <button
              key={section.id}
              type="button"
              className={`dashboard-card${isActive ? ' is-active' : ''}`}
              onClick={() => onSectionSelect(section.id)}
            >
              <span className="dashboard-card__label">{section.label}</span>
              <div className="dashboard-card__top">
                <strong>{section.lawyerMetric.value}</strong>
                <small>{section.lawyerMetric.label}</small>
              </div>
              <MiniChart values={section.lawyerMetric.trend} emphasis={isActive ? 'high' : 'medium'} />
              <p>{section.lawyerMetric.description}</p>
            </button>
          )
        })}
      </section>

      <section className="insights-grid">
        <article className="detail-card detail-card--wide">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">Pagina selecionada</span>
              <h2>{currentSection.label}</h2>
            </div>
            <strong className="detail-card__tag">{currentSection.tag}</strong>
          </div>

          <p>{currentSection.lawyerNarrative}</p>

          <div className="task-list">
            {currentSection.lawyerTasks.map((task) => (
              <article key={task.title} className="task-card">
                <strong>{task.title}</strong>
                <p>{task.description}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="detail-card">
          <div className="detail-card__header">
            <div>
              <span className="detail-card__eyebrow">Proxima acao</span>
              <h2>Fila priorizada</h2>
            </div>
          </div>

          <div className="priority-stack">
            {pendingItems.slice(0, 3).map((item) => (
              <div key={item.caseNumber} className={`priority-pill priority-${item.priority}`}>
                <strong>{item.title}</strong>
                <span>{item.priorityLabel}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}

function MiniChart({
  values,
  emphasis = 'medium',
}: {
  values: number[]
  emphasis?: 'medium' | 'high'
}) {
  return (
    <div className={`mini-chart mini-chart--${emphasis}`} aria-hidden="true">
      <div className="mini-chart__grid" />
      <div className="mini-chart__bars">
        {values.map((value, index) => (
          <span key={`${index}-${value}`} style={{ height: `${value}%` }} />
        ))}
      </div>
      <div className="mini-chart__footer">
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  )
}

function PendingCard({ item }: { item: PendingItem }) {
  return (
    <article className={`pending-item priority-${item.priority}`}>
      <div className="pending-item__row">
        <strong>{item.title}</strong>
        <span>{item.priorityLabel}</span>
      </div>
      <p>{item.caseNumber}</p>
      <small>{item.owner}</small>
    </article>
  )
}
