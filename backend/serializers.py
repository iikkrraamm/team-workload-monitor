def member_row_to_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "role": row["role"],
        "capacity_hours_per_day": row["capacity_hours_per_day"],
        "color": row["color"],
    }


def activity_row_to_dict(row):
    return {
        "id": row["id"],
        "member_id": row["member_id"],
        "title": row["title"],
        "hours": row["hours"],
        "date": row["date"],
    }