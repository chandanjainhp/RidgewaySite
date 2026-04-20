import { useQuery } from "@tanstack/react-query";
import { getSiteMapData } from "@/lib/api";

export default function useSiteMap() {
  return useQuery({
    queryKey: ["siteMap"],
    queryFn: () => getSiteMapData(),
    staleTime: 3600000,
    retry: (failureCount, error) => {
      if (error?.statusCode === 401 || error?.statusCode === 403) {
        return false;
      }
      return failureCount < 2;
    },
    onError: (error) => {
      console.error("SITE MAP FETCH FAILED", error?.message);
    },
  });
}
