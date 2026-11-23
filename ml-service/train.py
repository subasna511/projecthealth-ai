
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

rng = np.random.default_rng(42)

# Generate synthetic project activity data
samples = 2000

completion = rng.uniform(0, 1, samples)
overdue = rng.uniform(0, 1, samples)
upcoming = rng.uniform(0, 1, samples)
unassigned = rng.uniform(0, 1, samples)
workload = rng.uniform(0, 1, samples)

X = np.column_stack([
    completion,
    overdue,
    upcoming,
    unassigned,
    workload
])

# Synthetic labels generated from predefined rules
risk_score = (
    (1 - completion) * 30
    + overdue * 40
    + upcoming * 10
    + unassigned * 10
    + workload * 10
)

y = np.where(
    risk_score >= 55,
    "High",
    np.where(risk_score >= 30, "Medium", "Low")
)

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42,
    class_weight="balanced"
)

model.fit(X_train, y_train)

predictions = model.predict(X_test)
accuracy = accuracy_score(y_test, predictions)

joblib.dump(model, "risk_model.joblib")

print("Model trained successfully!")
print(f"Synthetic test accuracy: {accuracy:.2%}")
print("Model saved as risk_model.joblib")
