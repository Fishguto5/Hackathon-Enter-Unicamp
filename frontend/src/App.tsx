import { useState } from 'react'
import { LoginView } from './components/LoginView'
import { MainDashboard } from './components/MainDashboard'
import { dashboardSections, loginOptions, type LoginOptionId } from './data/dashboard'

function App() {
  const [selectedRole, setSelectedRole] = useState<LoginOptionId>('lawyer')
  const [authenticatedRole, setAuthenticatedRole] = useState<LoginOptionId | null>(null)
  const [activeSection, setActiveSection] = useState<(typeof dashboardSections)[number]['id']>('home')

  const handleAuthenticate = () => {
    setAuthenticatedRole(selectedRole)
    setActiveSection('home')
  }

  const handleLogout = () => {
    setAuthenticatedRole(null)
    setActiveSection('home')
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

  return (
    <MainDashboard
      activeSection={activeSection}
      onLogout={handleLogout}
      onSectionSelect={setActiveSection}
      role={authenticatedRole}
      sections={dashboardSections}
    />
  )
}

export default App
