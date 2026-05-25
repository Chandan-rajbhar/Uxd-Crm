import { Link, useLocation } from "react-router-dom"
import { ChevronRight, type LucideIcon } from "lucide-react"


import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  TooltipPortal,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
      isActive?: boolean
      trackerComment?: string
      items?: {
        title: string
        url: string
      }[]
    }[]
  }[]
}) {
  const location = useLocation()

  const isActive = (url: string) => {
    if (url === "/" || url === "#") {
      return location.pathname === url
    }
    // If it's a specific route like /leads/abc, it should match that exactly
    // but also allow base routes to be active if they have nested sub-items
    return location.pathname === url || (url !== "/leads" && location.pathname.startsWith(url + "/"))
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => (
            <Collapsible
              key={item.title}
              asChild
              defaultOpen={item.isActive || item.items?.some(subItem => isActive(subItem.url) || subItem.items?.some(deep => isActive(deep.url)))}
              className="group/collapsible"
            >
              <SidebarMenuItem>
                {item.items ? (
                  <>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={item.title}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          subItem.items ? (
                            <Collapsible key={subItem.title} asChild className="group/sub">
                              <SidebarMenuSubItem>
                                <CollapsibleTrigger asChild>
                                  <SidebarMenuSubButton isActive={subItem.isActive || subItem.items.some(x => isActive(x.url))}>
                                    <span>{subItem.title}</span>
                                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/sub:rotate-90" />
                                  </SidebarMenuSubButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <SidebarMenuSub>
                                    {subItem.items.map((deepItem) => (
                                      <SidebarMenuSubItem key={deepItem.title}>
                                        <SidebarMenuSubButton asChild isActive={isActive(deepItem.url)}>
                                          <Link to={deepItem.url}>
                                            <span>{deepItem.title}</span>
                                          </Link>
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    ))}
                                  </SidebarMenuSub>
                                </CollapsibleContent>
                              </SidebarMenuSubItem>
                            </Collapsible>
                          ) : (
                             <SidebarMenuSubItem key={subItem.title}>
                               <SidebarMenuSubButton asChild isActive={isActive(subItem.url)}>
                                 <Link to={subItem.url}>
                                   <div className="flex items-center justify-between w-full">
                                     <span>{subItem.title}</span>
                                     {subItem.trackerComment && (
                                           <TooltipProvider delayDuration={0}>
                                         <Tooltip>
                                           <TooltipTrigger asChild>
                                             <Info className="h-4 w-4 text-red-600 animate-pulse ml-2 shrink-0" />
                                           </TooltipTrigger>
                                           <TooltipPortal>
                                             <TooltipContent side="right" className="z-[100] max-w-[350px] p-4 bg-white shadow-2xl border-2 border-red-500 rounded-xl">
                                               <p className="font-semibold text-red-600 mb-2 uppercase tracking-tight text-xs">Admin Note</p>
                                               <p className="leading-relaxed text-slate-900 text-sm font-medium">{subItem.trackerComment}</p>
                                             </TooltipContent>
                                           </TooltipPortal>
                                         </Tooltip>
                                       </TooltipProvider>
                                     )}
                                   </div>
                                 </Link>
                               </SidebarMenuSubButton>
                             </SidebarMenuSubItem>
                          )
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </>
                ) : (
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    isActive={isActive(item.url)}
                  >
                    <Link to={item.url}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            </Collapsible>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
