-- CreateTable
CREATE TABLE "recommendation_result" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "menu_item_id" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reason" VARCHAR(20) NOT NULL,
    "model_version" VARCHAR(40) NOT NULL,
    "generated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_run" (
    "id" TEXT NOT NULL,
    "task" VARCHAR(20) NOT NULL,
    "model_version" VARCHAR(40) NOT NULL,
    "algorithm" VARCHAR(60) NOT NULL,
    "metrics" JSONB NOT NULL,
    "synthetic_share" DOUBLE PRECISION NOT NULL,
    "train_rows" INTEGER NOT NULL,
    "data_from" DATE NOT NULL,
    "data_to" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendation_result_user_id_model_version_rank_idx" ON "recommendation_result"("user_id", "model_version", "rank");

-- CreateIndex
CREATE INDEX "recommendation_result_model_version_idx" ON "recommendation_result"("model_version");

-- CreateIndex
CREATE INDEX "model_run_task_created_at_idx" ON "model_run"("task", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "model_run_task_model_version_key" ON "model_run"("task", "model_version");

-- AddForeignKey
ALTER TABLE "recommendation_result" ADD CONSTRAINT "recommendation_result_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_result" ADD CONSTRAINT "recommendation_result_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
