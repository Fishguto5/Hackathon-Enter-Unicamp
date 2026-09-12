import { FormEvent } from 'react'
import {
  loginHighlights,
  type LoginOption,
  type LoginOptionId,
} from '../data/dashboard'

type LoginViewProps = {
  loginOptions: readonly LoginOption[]
  selectedRole: LoginOptionId
  onRoleSelect: (role: LoginOptionId) => void
  onSubmit: () => void
}

export function LoginView({
  loginOptions,
  selectedRole,
  onRoleSelect,
  onSubmit,
}: LoginViewProps) {
  const activeRole =
    loginOptions.find((option) => option.id === selectedRole) ?? loginOptions[0]

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <main className="page-shell page-shell--login">
      <section className="brand-panel" aria-hidden="true">
        <div className="brand-panel__content">
          <div className="brand-mark">
            <span className="brand-mark__icon" />
            <span className="brand-mark__text">EnterOS</span>
          </div>
          <p className="brand-panel__lead">
            Enterprise AI para operacoes juridicas em escala com decisao assistida e
            operacao centralizada.
          </p>

          <div className="brand-panel__highlights">
            {loginHighlights.map((highlight) => (
              <article key={highlight.title} className="highlight-card">
                <strong>{highlight.title}</strong>
                <p>{highlight.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__header">
            <span className="login-card__eyebrow">Enter OS</span>
            <h1>Entrar na plataforma</h1>
            <p>Escolha o perfil de acesso e use qualquer credencial para entrar no fluxo correspondente.</p>
          </div>

          <div className="role-selector" aria-label="Tipo de login">
            {loginOptions.map((option) => {
              const isActive = option.id === selectedRole

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`role-option${isActive ? ' is-active' : ''}`}
                  onClick={() => onRoleSelect(option.id)}
                  aria-pressed={isActive}
                >
                  <span>{option.label}</span>
                  <small>{option.shortLabel}</small>
                </button>
              )
            })}
          </div>

          <div className="role-summary">
            <strong>{activeRole.label}</strong>
            <p>{activeRole.description}</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder={
                selectedRole === 'employee'
                  ? 'colaborador@bancounicamp.com.br'
                  : 'advogado@escritorio.com.br'
              }
              autoComplete="email"
              required
            />

            <label htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Digite sua senha"
              autoComplete="current-password"
              required
            />

            <button type="submit" className="submit-button">
              Fazer autenticacao
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
