import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { useSidebarStore } from "../stores/sidebarStore";
import { motion, AnimatePresence } from "framer-motion";

const Layout = () => {
  const { isOpen, toggle } = useSidebarStore();

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-indigo-100 via-white to-purple-100">
      <div className="flex h-full relative">
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ x: -256 }}
                animate={{ x: 0 }}
                exit={{ x: -256 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className="fixed inset-y-0 left-0 z-30"
              >
                <Sidebar />
              </motion.div>
              <div
                className="fixed inset-0 bg-black/20 z-20 lg:hidden"
                onClick={() => useSidebarStore.getState().close()}
              />
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-h-0">
          <header className="flex items-center h-16 px-4 border-b bg-white/80 backdrop-blur-sm">
            <button
              onClick={toggle}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
          </header>

          <main className="flex-1 overflow-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
