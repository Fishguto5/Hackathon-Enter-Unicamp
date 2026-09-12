import { FormEvent, useState } from 'react'

const loginOptions = [
  {
    id: 'lawyer',
    label: 'Advogado',
    description: 'Texto a definir',
  },
  {
    id: 'employee',
    label: 'Funcionario da empresa',
    description: 'Texto a definir',
  },
] as const

type LoginOptionId = (typeof loginOptions)[number]['id']

function App() {
  const [selectedRole, setSelectedRole] = useState<LoginOptionId>('lawyer')

  const activeRole =
    loginOptions.find((option) => option.id === selectedRole) ?? loginOptions[0]

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
  }

  return (
    <main className="page-shell">
      <section className="brand-panel" aria-hidden="true">
        <div className="brand-panel__content">
          <div className="brand-mark">
            <span className="brand-mark__icon" />
            <span className="brand-mark__text">EnterOS</span>
          </div>
          <p className="brand-panel__lead">Enterprise AI para operacoes juridicas em escala.</p>
          <div className="brand-panel__accent" />
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__header">
            <span className="login-card__eyebrow">Enter OS</span>
            <h1>Entrar na plataforma</h1>
            <p>
              Escolha o perfil de acesso e preencha suas credenciais para continuar.
            </p>
          </div>

          <div className="role-selector" aria-label="Tipo de login">
            {loginOptions.map((option) => {
              const isActive = option.id === selectedRole

              return (
                <button
                  key={option.id}
                  type="button"
                  className={`role-option${isActive ? ' is-active' : ''}`}
                  onClick={() => setSelectedRole(option.id)}
                  aria-pressed={isActive}
                >
                  <span>{option.label}</span>
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
              placeholder="nome@empresa.com.br"
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
              Fazer autenticação
            </button>
          </form>


        </div>
      </section>
    </main>
  )
}

export default App
