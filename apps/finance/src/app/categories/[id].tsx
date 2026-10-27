import { useLocalSearchParams } from "expo-router";

import { CategoryForm } from "@/features/categories/category-form";

export default function EditCategory() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CategoryForm id={id} />;
}
