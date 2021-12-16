SRC_DIR = public/data

$(SRC_DIR):
	mkdir -p $@
	
Global_vaccination_search_insights.csv: $(SRC_DIR)
	curl -o $(SRC_DIR)/Global_vaccination_search_insights.csv https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/Global_vaccination_search_insights.csv

GB_vaccination_search_insights.csv: $(SRC_DIR)
	curl -o $(SRC_DIR)/GB_vaccination_search_insights.csv https://storage.googleapis.com/covid19-open-data/covid19-vaccination-search-insights/staging/GB_vaccination_search_insights.csv

Global_l0_vaccination_search_insights.csv:
	cat $(SRC_DIR)/Global_vaccination_search_insights.csv | awk 'NR==1' > $(SRC_DIR)/$@
	cat $(SRC_DIR)/Global_vaccination_search_insights.csv | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' 'length($$4) < 1' >> $(SRC_DIR)/$@
	cat $(SRC_DIR)/GB_vaccination_search_insights.csv | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' 'length($$4) < 1' >> $(SRC_DIR)/$@

regions.csv: Global_vaccination_search_insights.csv
	cat $(SRC_DIR)/$< | awk -vFPAT='[^,]*|"[^"]*"' -v OFS=',' '{ print $$2,$$3,$$4,$$5,$$6,$$7,$$8,$$9,$$10 }' | uniq > $(SRC_DIR)/$@
	cat $(SRC_DIR)/gb_regions.csv | awk 'NR>1' >> $(SRC_DIR)/$@

data: Global_l0_vaccination_search_insights.csv Global_vaccination_search_insights.csv GB_vaccination_search_insights.csv regions.csv
