// /app/admin/layout.tsx
import SidebarNav from '@/components/admin/SidebarNav'
import Logo from '@/components/admin/Logo'
import AdminLink from '@/components/admin/AdminLink'
import { NavigationBlockerProvider } from '@/components/admin/NavigationBlocker'
import { NotificationProvider } from '@/components/admin/NotificationProvider'
import { getLastEdit } from '@/lib/app-meta'
import { logout } from '@/app/login/actions'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const lastEdit = await getLastEdit()
  const lastEditLabel = lastEdit
    ? lastEdit.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <NotificationProvider>
      <NavigationBlockerProvider>
        <div className="flex min-h-screen bg-white">
          {/* Sidebar */}
          <aside className="sticky top-0 hidden h-screen w-64 flex-col bg-dynamicBlack text-baliPearl md:flex">
            <AdminLink href="/admin/materials" className="mb-10 block px-6 pt-6">
              <Logo className="h-auto w-32 text-baliPearl" />
              <p className="mt-2 text-[10px] uppercase tracking-widest text-bubonicBrown">
                Panel de gestión
              </p>
            </AdminLink>

            <SidebarNav />

            <div className="mt-auto border-t border-baliPearl/20 px-6 py-6">
              <p className="font-vollkorn text-sm italic text-baliPearl/50">Desde 1977</p>

              <div className="mt-6">
                <form action={logout}>
                  <button
                    type="submit"
                    className="cursor-pointer text-[10px] uppercase tracking-widest text-baliPearl/60 default-transition hover:text-bubonicBrown"
                  >
                    Cerrar sesión
                  </button>
                </form>
                {lastEditLabel && (
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-baliPearl/30">
                    Última edición: {lastEditLabel}
                  </p>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-6 md:p-8">
            {children}
          </main>
        </div>
      </NavigationBlockerProvider>
    </NotificationProvider>
  )
}
