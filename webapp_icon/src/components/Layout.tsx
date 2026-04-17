import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export const Layout = () => {
    return (
        <div className="flex flex-col h-screen w-full font-primary bg-[#FAFAFA]">
            <Header />
            <main className="flex-1 flex overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
};
