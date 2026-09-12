import { useState } from 'react'
import { LoginView } from './components/LoginView'
import { MainDashboard } from './components/MainDashboard'
import { loginOptions, type LoginOptionId } from './data/dashboard'

function App() {
  const [selectedRole, setSelectedRole] = useState<LoginOptionId>('lawyer')
  const [authenticatedRole, setAuthenticatedRole] = useState<LoginOptionId | null>(null)

  const handleAuthenticate = () => {
    setAuthenticatedRole(selectedRole)
  }

  const handleLogout = () => {
    setAuthenticatedRole(null)
  }

  if (!authenticatedRole) {
    return (
      <LoginView
        loginOptions={loginOptions}
        selectedRole={selectedRole}
        onRoleSelect={setSelectedRole}
        onSubmit={handleAuthenticate}
      />
    )
  }

  return <MainDashboard onLogout={handleLogout} role={authenticatedRole} />
}

export default App
