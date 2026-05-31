-- RPC to increment view count atomically and insert view log
CREATE OR REPLACE FUNCTION increment_geo_view(p_page_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public_geo_pages
  SET view_count = view_count + 1,
      updated_at = now()
  WHERE id = p_page_id AND published = true;
END;
$$;

-- Allow anon/service to call this function
GRANT EXECUTE ON FUNCTION increment_geo_view(UUID) TO anon, authenticated, service_role;
