"use client";

import { Activity, Bell, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
	label: string;
	href: string;
	icon: React.ReactNode;
}

const navItems: NavItem[] = [
	{
		label: "Monitors",
		href: "/dashboard/monitors",
		icon: <Activity className="h-4 w-4" />,
	},
	{
		label: "Alerts",
		href: "/dashboard/alerts",
		icon: <Bell className="h-4 w-4" />,
	},
	{
		label: "Integrations",
		href: "/dashboard/settings/integrations",
		icon: <Settings className="h-4 w-4" />,
	},
];

export function SidebarNav() {
	const pathname = usePathname();

	return (
		<nav aria-label="Sidebar" className="flex flex-col gap-1">
			{navItems.map((item) => {
				const isActive =
					pathname === item.href || pathname.startsWith(`${item.href}/`);

				return (
					<Link
						key={item.href}
						href={item.href}
						aria-current={isActive ? "page" : undefined}
						className={cn(
							"flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
							"[touch-action:manipulation]",
							"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-1",
							isActive
								? "bg-orange-50 text-orange-600"
								: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
						)}
					>
						<span
							aria-hidden="true"
							className={cn(
								"flex-shrink-0",
								isActive ? "text-orange-500" : "text-gray-400",
							)}
						>
							{item.icon}
						</span>
						{item.label}
					</Link>
				);
			})}
		</nav>
	);
}
