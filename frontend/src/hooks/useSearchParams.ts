import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type SearchEntity = "ships" | "blueprints";

export function useSearchEntity(): { entity: SearchEntity } {
  const [params] = useSearchParams();
  return useMemo(() => {
    const entity = params.get("entity");
    return {
      entity: entity === "blueprints" ? "blueprints" : "ships",
    };
  }, [params]);
}
